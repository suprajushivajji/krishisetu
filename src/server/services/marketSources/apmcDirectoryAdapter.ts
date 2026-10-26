/**
 * Source C: APMC Directory and Contact Information Adapter
 *
 * This adapter ingests official APMC/market directory data from:
 * - State agricultural marketing department pages
 * - Government market committee pages
 * - Official public directories
 * - Permitted data downloads
 *
 * Current implementation:
 * - Supports CSV import of APMC directory data
 * - Stores comprehensive market contact information
 * - Tracks coordinate provenance and verification status
 *
 * Future enhancement:
 * - Web scraping of official public pages where permitted
 * - Integration with state-specific APMC APIs if available
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import {
  SourceAdapter,
  SourceSyncResult,
  SourceHealth,
  SourceType,
  NormalizedMarketDirectory,
  VerificationState,
} from "./types";

// Define a new MongoDB model for APMC directory entries
const ApmcDirectorySchema = new mongoose.Schema({
  sourceType: { type: String, required: true },
  sourceName: { type: String, required: true },
  sourceRecordId: { type: String, trim: true },
  sourceUrl: { type: String, trim: true },
  marketName: { type: String, required: true, trim: true },
  officialIdentifier: { type: String, trim: true },
  state: { type: String, required: true, trim: true },
  district: { type: String, required: true, trim: true },
  taluk: { type: String, trim: true },
  locality: { type: String, trim: true },
  fullAddress: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  website: { type: String, trim: true },
  marketType: { type: String, trim: true },
  openingHours: { type: String, trim: true },
  location: {
    type: { type: String, enum: ["Point"], required: false },
    coordinates: { type: [Number], required: false }, // [longitude, latitude]
  },
  coordinateProvenance: { type: String, trim: true },
  coordinateResolutionStatus: { type: String, enum: ["verified", "approximate", "unknown"] },
  lastVerifiedDate: { type: Date },
  verificationState: { type: String, enum: ["official", "verified_source", "public_listing", "unverified"], default: "public_listing" },
  retrievedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ApmcDirectorySchema.index({ sourceType: 1, sourceRecordId: 1 }, { unique: true, sparse: true });
ApmcDirectorySchema.index({ state: 1, district: 1, marketName: 1 });
ApmcDirectorySchema.index({ location: "2dsphere" });
ApmcDirectorySchema.index({ verificationState: 1 });

export const ApmcDirectory =
  mongoose.models.ApmcDirectory ||
  mongoose.model("ApmcDirectory", ApmcDirectorySchema);

export class ApmcDirectoryAdapter implements SourceAdapter {
  sourceType: SourceType = "apmc_directory";
  sourceName = "APMC Directory (official)";

  isConfigured(): boolean {
    return true;
  }

  async sync(options: { csvPath?: string; overwrite?: boolean } = {}): Promise<SourceSyncResult> {
    const { csvPath, overwrite = false } = options;
    const retrievedAt = new Date();

    // Default CSV path for APMC directory data
    const filePath = csvPath || path.resolve(process.cwd(), "src/source/apmc_directory.csv");

    try {
      if (!fs.existsSync(filePath)) {
        return {
          sourceType: this.sourceType,
          sourceName: this.sourceName,
          status: "unconfigured",
          recordsFetched: 0,
          recordsInserted: 0,
          recordsSkipped: 0,
          recordsUpdated: 0,
          retrievedAt,
          message: `APMC directory CSV not found at ${filePath}. Please place official directory data in src/source/ directory.`,
        };
      }

      const csvContent = fs.readFileSync(filePath, "utf8");
      const records = this.parseCsvRecords(csvContent);

      if (records.length === 0) {
        return {
          sourceType: this.sourceType,
          sourceName: this.sourceName,
          status: "failed",
          recordsFetched: 0,
          recordsInserted: 0,
          recordsSkipped: 0,
          recordsUpdated: 0,
          retrievedAt,
          message: "CSV file contains no valid records",
        };
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const item of records) {
        try {
          const normalized = this.normalizeRecord(item, retrievedAt);
          if (!normalized) {
            skipped++;
            continue;
          }

          const result = await this.upsertRecord(normalized, overwrite);
          if (result === "inserted") inserted++;
          else if (result === "updated") updated++;
          else skipped++;
        } catch (err: any) {
          skipped++;
          errors.push(`${item.market_name || "unknown"}: ${err.message}`);
        }
      }

      return {
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        status: errors.length > 0 && errors.length < records.length ? "partial" : "success",
        recordsFetched: records.length,
        recordsInserted: inserted,
        recordsSkipped: skipped,
        recordsUpdated: updated,
        retrievedAt,
        message: errors.length > 0 ? `Completed with ${errors.length} errors` : undefined,
        errorDetails: errors.length > 0 ? errors.join("; ") : undefined,
      };
    } catch (error: any) {
      console.error("❌ [APMC Directory Sync Error]:", error?.message);
      return {
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        status: "failed",
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        recordsUpdated: 0,
        retrievedAt,
        message: error?.message || "Failed to import APMC directory",
        errorDetails: error?.stack,
      };
    }
  }

  getHealth(): SourceHealth {
    return {
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      isConfigured: true,
      status: "healthy",
      recordsInDatabase: 0, // Will be populated by health endpoint
    };
  }

  private parseCsvRecords(csv: string): Array<Record<string, string>> {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < csv.length; index += 1) {
      const character = csv[index];
      const nextCharacter = csv[index + 1];

      if (character === '"' && quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(field);
        field = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && nextCharacter === "\n") index += 1;
        row.push(field);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    if (field || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    if (rows.length === 0) return [];

    const headers = (rows.shift() || []).map((header) =>
      header
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase()
        .replace(/_x0020_/g, "_")
        .replace(/\s+/g, "_")
    );

    return rows.map((values) =>
      headers.reduce<Record<string, string>>((record, header, index) => {
        record[header] = (values[index] || "").trim();
        return record;
      }, {})
    );
  }

  private normalizeRecord(item: Record<string, string>, retrievedAt: Date): NormalizedMarketDirectory | null {
    const marketName = item.market_name || item.market;
    const state = item.state;
    const district = item.district;

    if (!marketName || !state || !district) {
      return null;
    }

    const latitude = Number(item.latitude) || undefined;
    const longitude = Number(item.longitude) || undefined;

    return {
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      sourceRecordId: item.id || item.market_id || undefined,
      sourceUrl: item.source_url || undefined,
      marketName: marketName.trim(),
      officialIdentifier: item.official_identifier || item.market_id || undefined,
      state: state.trim(),
      district: district.trim(),
      taluk: item.taluk?.trim(),
      locality: item.locality?.trim(),
      fullAddress: item.address || item.full_address?.trim(),
      phone: item.phone?.trim(),
      email: item.email?.trim(),
      website: item.website?.trim(),
      marketType: item.market_type?.trim(),
      openingHours: item.opening_hours?.trim(),
      latitude,
      longitude,
      coordinates: latitude && longitude ? [longitude, latitude] : undefined,
      coordinateProvenance: item.coordinate_provenance || (latitude && longitude ? "csv_import" : undefined),
      coordinateResolutionStatus: latitude && longitude ? "verified" : "unknown",
      lastVerifiedDate: item.last_verified_date ? new Date(item.last_verified_date) : undefined,
      verificationState: (item.verification_state as VerificationState) || "public_listing",
      retrievedAt,
    };
  }

  private async upsertRecord(
    normalized: NormalizedMarketDirectory,
    overwrite: boolean
  ): Promise<"inserted" | "updated" | "skipped"> {
    const filter = normalized.sourceRecordId
      ? { sourceType: normalized.sourceType, sourceRecordId: normalized.sourceRecordId }
      : {
          sourceType: normalized.sourceType,
          state: normalized.state,
          district: normalized.district,
          marketName: normalized.marketName,
        };

    const existing = await ApmcDirectory.findOne(filter);

    if (existing) {
      if (overwrite || normalized.retrievedAt > existing.retrievedAt) {
        const updateData: any = {
          ...normalized,
          updatedAt: new Date(),
        };

        if (normalized.coordinates) {
          updateData.location = {
            type: "Point",
            coordinates: normalized.coordinates,
          };
        }

        await ApmcDirectory.updateOne({ _id: existing._id }, { $set: updateData });
        return "updated";
      }
      return "skipped";
    }

    const createData: any = {
      ...normalized,
    };

    if (normalized.coordinates) {
      createData.location = {
        type: "Point",
        coordinates: normalized.coordinates,
      };
    }

    await ApmcDirectory.create(createData);
    return "inserted";
  }
}
