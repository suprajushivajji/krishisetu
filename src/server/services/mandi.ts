import axios from "axios";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { MarketPrice } from "../models/MarketPrice";

export interface SyncResult {
  recordsFetched: number;
  recordsInserted: number;
  recordsSkipped: number;
  source: string;
  sourceDate?: string;
  retrievedAt: Date;
  status: "success" | "unconfigured" | "failed";
  message?: string;
}

export class MandiPriceService {
  /**
   * Fetches official Mandi records from data.gov.in / AGMARKNET resource
   */
  public static async syncMarketPrices(limit: number = 1000): Promise<SyncResult> {
    if (!config.DATA_GOV_IN_API_KEY) {
      return {
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        source: "AGMARKNET / data.gov.in",
        retrievedAt: new Date(),
        status: "unconfigured",
        message: "DATA_GOV_IN_API_KEY is not configured in server environment. Official live sync is paused.",
      };
    }

    try {
      const url = `https://api.data.gov.in/resource/${config.AGMARKNET_RESOURCE_ID}`;
      const response = await axios.get(url, {
        headers: {
          Accept: "application/xml",
        },
        params: {
          "api-key": config.DATA_GOV_IN_API_KEY,
          format: "csv",
          limit,
        },
        responseType: "text",
        timeout: 15000,
      });

      const records = this.parseCsvRecords(String(response.data || ""));
      let inserted = 0;
      let skipped = 0;

      for (const item of records) {
        try {
          let arrivalDate = new Date();
          if (item.arrival_date) {
            // data.gov.in returns "DD/MM/YYYY" like "24/10/2026"
            const parts = String(item.arrival_date).split("/");
            if (parts.length === 3) {
              const day = Number.parseInt(parts[0], 10);
              const month = Number.parseInt(parts[1], 10) - 1;
              const year = Number.parseInt(parts[2], 10);
              arrivalDate = new Date(Date.UTC(year, month, day));
            } else {
              arrivalDate = new Date(item.arrival_date);
            }
          }

          const modalPrice = Number(item.modal_price) || 0;
          const minPrice = Number(item.min_price) || modalPrice;
          const maxPrice = Number(item.max_price) || modalPrice;
          const modalPricePerKg = Number((modalPrice / 100).toFixed(2)); // AGMARKNET is in Rs/Quintal

          await MarketPrice.updateOne(
            {
              source: "AGMARKNET (data.gov.in)",
              state: item.state || "Karnataka",
              district: item.district || "Davanagere",
              market: item.market || "APMC",
              commodity: item.commodity || "Tomato",
              arrivalDate: arrivalDate,
            },
            {
              $set: {
                source: "AGMARKNET (data.gov.in)",
                sourceRecordId: item._id || undefined,
                state: item.state || "Karnataka",
                district: item.district || "Davanagere",
                market: item.market || "APMC",
                commodity: item.commodity || "Tomato",
                variety: item.variety || "Common",
                grade: item.grade || "FAQ",
                arrivalDate: arrivalDate,
                minPrice,
                maxPrice,
                modalPrice,
                originalUnit: "Rs/Quintal",
                modalPricePerKg,
                retrievedAt: new Date(),
                isStale: false,
              },
            },
            { upsert: true }
          );
          inserted++;
        } catch (err: any) {
          skipped++;
        }
      }

      return {
        recordsFetched: records.length,
        recordsInserted: inserted,
        recordsSkipped: skipped,
        source: "data.gov.in (AGMARKNET)",
        retrievedAt: new Date(),
        status: "success",
      };
    } catch (error: any) {
      console.error("❌ [Mandi Sync Error]:", error?.message);
      return {
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        source: "AGMARKNET",
        retrievedAt: new Date(),
        status: "failed",
        message: error?.message || "Failed to reach data.gov.in API",
      };
    }
  }

  public static async removeDemonstrationRecords(): Promise<void> {
    await MarketPrice.deleteMany({ source: /Demonstration Seed/i });
  }

  public static async syncLocalMarketPrices(): Promise<SyncResult> {
    const filePath = path.resolve(process.cwd(), "src/source/9ef84268-d588-465a-a308-a864a43d0070.csv");

    try {
      const records = this.parseCsvRecords(fs.readFileSync(filePath, "utf8"));
      const operations = records
        .map((item) => {
          const arrivalDate = this.parseArrivalDate(item.arrival_date);
          const modalPrice = Number(item.modal_price);
          const minPrice = Number(item.min_price);
          const maxPrice = Number(item.max_price);

          if (!item.state || !item.district || !item.market || !item.commodity || !Number.isFinite(modalPrice)) {
            return null;
          }

          return {
            updateOne: {
              filter: {
                source: "AGMARKNET (downloaded CSV)",
                state: item.state,
                district: item.district,
                market: item.market,
                commodity: item.commodity,
                arrivalDate,
              },
              update: {
                $set: {
                  source: "AGMARKNET (downloaded CSV)",
                  state: item.state,
                  district: item.district,
                  market: item.market,
                  commodity: item.commodity,
                  variety: item.variety || "Common",
                  grade: item.grade || "FAQ",
                  arrivalDate,
                  minPrice: Number.isFinite(minPrice) ? minPrice : modalPrice,
                  maxPrice: Number.isFinite(maxPrice) ? maxPrice : modalPrice,
                  modalPrice,
                  originalUnit: "Rs/Quintal",
                  modalPricePerKg: Number((modalPrice / 100).toFixed(2)),
                  retrievedAt: new Date(),
                  isStale: false,
                },
              },
              upsert: true,
            },
          };
        })
        .filter((operation): operation is NonNullable<typeof operation> => operation !== null);

      if (operations.length > 0) {
        await MarketPrice.bulkWrite(operations, { ordered: false });
      }

      return {
        recordsFetched: records.length,
        recordsInserted: operations.length,
        recordsSkipped: records.length - operations.length,
        source: "AGMARKNET (downloaded CSV)",
        retrievedAt: new Date(),
        status: "success",
      };
    } catch (error: any) {
      return {
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        source: "AGMARKNET (downloaded CSV)",
        retrievedAt: new Date(),
        status: "failed",
        message: error?.message || "Failed to import the downloaded market CSV",
      };
    }
  }

  private static parseCsvRecords(csv: string): Array<Record<string, string>> {
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

  private static parseArrivalDate(value?: string): Date {
    const parts = String(value || "").split("/");
    if (parts.length === 3) {
      return new Date(Date.UTC(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])));
    }
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

}
