/**
 * Source B: AGMARKNET/e-NAM Market Price Dashboard Adapter
 * Official dashboard: https://www.enam.gov.in/web/dashboard/agmarknet
 *
 * Note: This adapter can ingest permitted CSV exports from the official dashboard.
 * If an authorized API endpoint becomes available with proper credentials,
 * it can be extended to use it directly.
 *
 * Current implementation:
 * - Supports CSV export ingestion from official AGMARKNET dashboard
 * - Schema validation and normalization
 * - Idempotent imports
 *
 * Documentation for permitted data collection:
 * - https://agmarknet.gov.in (official price reporting portal)
 * - https://enam.gov.in (e-NAM unified market platform)
 */

import fs from "fs";
import path from "path";
import { MarketPrice } from "../../models/MarketPrice";
import {
  SourceAdapter,
  SourceSyncResult,
  SourceHealth,
  SourceType,
  NormalizedPriceObservation,
  VerificationState,
} from "./types";

export class AgmarknetAdapter implements SourceAdapter {
  sourceType: SourceType = "agmarknet";
  sourceName = "AGMARKNET (official dashboard)";

  isConfigured(): boolean {
    // This source is always available for CSV import
    // API integration would require additional credentials
    return true;
  }

  async sync(options: { csvPath?: string; overwriteNewer?: boolean } = {}): Promise<SourceSyncResult> {
    const { csvPath, overwriteNewer = false } = options;
    const retrievedAt = new Date();

    // Default to the downloaded CSV if no path provided
    const filePath = csvPath || path.resolve(process.cwd(), "src/source/9ef84268-d588-465a-a308-a864a43d0070.csv");

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
          message: `CSV file not found at ${filePath}. Please download from official AGMARKNET dashboard and place in src/source/ directory.`,
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

          const result = await this.upsertRecord(normalized, overwriteNewer);
          if (result === "inserted") inserted++;
          else if (result === "updated") updated++;
          else skipped++;
        } catch (err: any) {
          skipped++;
          errors.push(`${item.market || "unknown"}: ${err.message}`);
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
      console.error("❌ [Agmarknet Sync Error]:", error?.message);
      return {
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        status: "failed",
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        recordsUpdated: 0,
        retrievedAt,
        message: error?.message || "Failed to import AGMARKNET CSV",
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

  private normalizeRecord(item: Record<string, string>, retrievedAt: Date): NormalizedPriceObservation | null {
    const state = item.state || item.State;
    const district = item.district || item.District;
    const market = item.market || item.Market;
    const commodity = item.commodity || item.Commodity;
    const modalPrice = Number(item.modal_price || item.Modal_x0020_Price || 0);

    if (!state || !district || !market || !commodity || !Number.isFinite(modalPrice) || modalPrice <= 0) {
      return null;
    }

    const arrivalDate = this.parseArrivalDate(item.arrival_date || item.Arrival_Date);
    const minPrice = Number(item.min_price || item.Min_x0020_Price || modalPrice);
    const maxPrice = Number(item.max_price || item.Max_x0020_Price || modalPrice);

    return {
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      sourceRecordId: undefined, // CSV exports may not have IDs
      sourceUrl: "https://www.enam.gov.in/web/dashboard/agmarknet",
      state: state.trim(),
      district: district.trim(),
      market: market.trim(),
      commodity: commodity.trim(),
      variety: (item.variety || item.Variety || "Common").trim(),
      grade: (item.grade || item.Grade || "FAQ").trim(),
      minPrice: Number.isFinite(minPrice) ? minPrice : modalPrice,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : modalPrice,
      modalPrice,
      originalUnit: "Rs/Quintal",
      modalPricePerKg: Number((modalPrice / 100).toFixed(2)),
      arrivalDate,
      reportedDate: arrivalDate,
      retrievedAt,
      verificationState: "official",
      isStale: false,
    };
  }

  private async upsertRecord(
    normalized: NormalizedPriceObservation,
    overwriteNewer: boolean
  ): Promise<"inserted" | "updated" | "skipped"> {
    const filter = {
      source: normalized.sourceName,
      state: normalized.state,
      district: normalized.district,
      market: normalized.market,
      commodity: normalized.commodity,
      arrivalDate: normalized.arrivalDate,
    };

    const existing = await MarketPrice.findOne(filter);

    if (existing) {
      // Update if overwriteNewer is true or if retrieved timestamp is newer
      if (overwriteNewer || normalized.retrievedAt > existing.retrievedAt) {
        await MarketPrice.updateOne(
          { _id: existing._id },
          {
            $set: {
              variety: normalized.variety,
              grade: normalized.grade,
              minPrice: normalized.minPrice,
              maxPrice: normalized.maxPrice,
              modalPrice: normalized.modalPrice,
              modalPricePerKg: normalized.modalPricePerKg,
              retrievedAt: normalized.retrievedAt,
              isStale: normalized.isStale,
            },
          }
        );
        return "updated";
      }
      return "skipped";
    }

    await MarketPrice.create({
      source: normalized.sourceName,
      state: normalized.state,
      district: normalized.district,
      market: normalized.market,
      commodity: normalized.commodity,
      variety: normalized.variety,
      grade: normalized.grade,
      arrivalDate: normalized.arrivalDate,
      minPrice: normalized.minPrice,
      maxPrice: normalized.maxPrice,
      modalPrice: normalized.modalPrice,
      originalUnit: normalized.originalUnit,
      modalPricePerKg: normalized.modalPricePerKg,
      retrievedAt: normalized.retrievedAt,
      isStale: normalized.isStale,
    });

    return "inserted";
  }

  private parseArrivalDate(value?: string): Date {
    if (!value) return new Date();

    const parts = String(value).split("/");
    if (parts.length === 3) {
      const day = Number.parseInt(parts[0], 10);
      const month = Number.parseInt(parts[1], 10) - 1;
      const year = Number.parseInt(parts[2], 10);
      const date = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(date.getTime())) return date;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
