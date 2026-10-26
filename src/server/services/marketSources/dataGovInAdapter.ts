/**
 * Source A: Official data.gov.in Mandi API Adapter
 * Resource: https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi
 * Resource ID: 9ef84268-d588-465a-a308-a864a43d0070
 */

import axios, { AxiosError } from "axios";
import { config } from "../../config";
import { MarketPrice } from "../../models/MarketPrice";
import {
  SourceAdapter,
  SourceSyncResult,
  SourceHealth,
  SourceType,
  NormalizedPriceObservation,
  VerificationState,
} from "./types";

export class DataGovInAdapter implements SourceAdapter {
  sourceType: SourceType = "data_gov_in";
  sourceName = "data.gov.in (AGMARKNET)";

  private readonly RESOURCE_ID = config.AGMARKNET_RESOURCE_ID || "9ef84268-d588-465a-a308-a864a43d0070";
  private readonly BASE_URL = "https://api.data.gov.in/resource";
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly TIMEOUT_MS = 30000;

  isConfigured(): boolean {
    return Boolean(config.DATA_GOV_IN_API_KEY && config.DATA_GOV_IN_API_KEY.length > 0);
  }

  async sync(options: { limit?: number; state?: string; district?: string; commodity?: string } = {}): Promise<SourceSyncResult> {
    if (!this.isConfigured()) {
      return {
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        status: "unconfigured",
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        recordsUpdated: 0,
        retrievedAt: new Date(),
        message: "DATA_GOV_IN_API_KEY is not configured in server environment",
      };
    }

    const { limit = 1000, state, district, commodity } = options;
    const retrievedAt = new Date();

    try {
      const url = `${this.BASE_URL}/${this.RESOURCE_ID}`;
      const params: any = {
        "api-key": config.DATA_GOV_IN_API_KEY,
        format: "csv",
        limit,
        offset: 0,
      };

      // Add filters if provided
      if (state) params.state = state;
      if (district) params.district = district;
      if (commodity) params.commodity = commodity;

      const response = await this.fetchWithRetry(url, params);

      if (!response || response.length === 0) {
        return {
          sourceType: this.sourceType,
          sourceName: this.sourceName,
          status: "success",
          recordsFetched: 0,
          recordsInserted: 0,
          recordsSkipped: 0,
          recordsUpdated: 0,
          retrievedAt,
          message: "API returned no records (possibly empty result set for given filters)",
        };
      }

      const records = this.parseCsvRecords(response);
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

          const result = await this.upsertRecord(normalized);
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
      console.error("❌ [DataGovIn Sync Error]:", error?.message);
      return {
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        status: "failed",
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        recordsUpdated: 0,
        retrievedAt,
        message: error?.message || "Failed to reach data.gov.in API",
        errorDetails: this.extractErrorDetails(error),
      };
    }
  }

  getHealth(): SourceHealth {
    const isConfigured = this.isConfigured();
    return {
      sourceType: this.sourceType,
      sourceName: this.sourceName,
      isConfigured,
      status: isConfigured ? "healthy" : "unconfigured",
      recordsInDatabase: 0, // Will be populated by the health endpoint
    };
  }

  private async fetchWithRetry(url: string, params: any, attempt = 1): Promise<string> {
    try {
      const response = await axios.get(url, {
        params,
        headers: {
          Accept: "application/csv, text/csv, */*",
        },
        responseType: "text",
        timeout: this.TIMEOUT_MS,
      });

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}`);
      }

      return response.data as string;
    } catch (error: any) {
      if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
        console.warn(`⚠️ [DataGovIn] Retry ${attempt}/${this.MAX_RETRIES} after error: ${error.message}`);
        await this.delay(this.RETRY_DELAY_MS * attempt);
        return this.fetchWithRetry(url, params, attempt + 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: AxiosError): boolean {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return true;
    if (error.response) {
      const status = error.response.status;
      return status >= 500 || status === 429;
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      sourceRecordId: item._id || undefined,
      sourceUrl: `https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi`,
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

  private async upsertRecord(normalized: NormalizedPriceObservation): Promise<"inserted" | "updated" | "skipped"> {
    const filter = {
      source: normalized.sourceName,
      sourceRecordId: normalized.sourceRecordId,
      state: normalized.state,
      district: normalized.district,
      market: normalized.market,
      commodity: normalized.commodity,
      arrivalDate: normalized.arrivalDate,
    };

    const existing = await MarketPrice.findOne(filter);

    if (existing) {
      // Update if retrieved timestamp is newer
      if (normalized.retrievedAt > existing.retrievedAt) {
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
      sourceRecordId: normalized.sourceRecordId,
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

  private extractErrorDetails(error: any): string {
    if (error.response) {
      return `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    }
    if (error.request) {
      return "No response received from server";
    }
    return error.message || "Unknown error";
  }
}
