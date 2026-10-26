/**
 * Multi-Source Market Discovery System
 * Unified interface for all source adapters
 */

import { DataGovInAdapter } from "./dataGovInAdapter";
import { AgmarknetAdapter } from "./agmarknetAdapter";
import { ApmcDirectoryAdapter, ApmcDirectory } from "./apmcDirectoryAdapter";
import { GooglePlacesAdapter } from "./googlePlacesAdapter";
import { KrishiSetuBuyersAdapter } from "./krishiSetuBuyersAdapter";
import {
  SourceAdapter,
  SourceSyncResult,
  SourceHealth,
  SourceType,
} from "./types";

export {
  DataGovInAdapter,
  AgmarknetAdapter,
  ApmcDirectoryAdapter,
  GooglePlacesAdapter,
  KrishiSetuBuyersAdapter,
  ApmcDirectory,
};

export type {
  SourceAdapter,
  SourceSyncResult,
  SourceHealth,
  SourceType,
  RecordType,
  VerificationState,
  NormalizedPriceObservation,
  NormalizedMarketDirectory,
  NormalizedPlaceResult,
} from "./types";

/**
 * Source Manager - Central orchestration of all source adapters
 */
export class SourceManager {
  private adapters: Map<SourceType, SourceAdapter> = new Map();

  constructor() {
    this.registerAdapter(new DataGovInAdapter());
    this.registerAdapter(new AgmarknetAdapter());
    this.registerAdapter(new ApmcDirectoryAdapter());
    this.registerAdapter(new GooglePlacesAdapter());
    this.registerAdapter(new KrishiSetuBuyersAdapter());
  }

  private registerAdapter(adapter: SourceAdapter): void {
    this.adapters.set(adapter.sourceType, adapter);
  }

  getAdapter(sourceType: SourceType): SourceAdapter | undefined {
    return this.adapters.get(sourceType);
  }

  getAllAdapters(): SourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  getConfiguredAdapters(): SourceAdapter[] {
    return this.getAllAdapters().filter((adapter) => adapter.isConfigured());
  }

  async syncSource(sourceType: SourceType, options?: any): Promise<SourceSyncResult> {
    const adapter = this.getAdapter(sourceType);
    if (!adapter) {
      throw new Error(`Unknown source type: ${sourceType}`);
    }

    return adapter.sync(options);
  }

  async syncAllConfigured(): Promise<SourceSyncResult[]> {
    const configured = this.getConfiguredAdapters();
    const results = await Promise.all(
      configured.map((adapter) => adapter.sync())
    );
    return results;
  }

  async getHealth(): Promise<SourceHealth[]> {
    const adapters = this.getAllAdapters();
    const healthPromises = adapters.map(async (adapter) => {
      const baseHealth = adapter.getHealth();

      // Enrich with database counts
      if (adapter.sourceType === "data_gov_in" || adapter.sourceType === "agmarknet") {
        const { MarketPrice } = await import("../../models/MarketPrice");
        const count = await MarketPrice.countDocuments({
          source: adapter.sourceName,
        });
        baseHealth.recordsInDatabase = count;

        const latest = await MarketPrice.findOne({ source: adapter.sourceName })
          .sort({ arrivalDate: -1 })
          .select("arrivalDate");
        if (latest) {
          baseHealth.mostRecentRecordDate = latest.arrivalDate;
        }
      } else if (adapter.sourceType === "apmc_directory") {
        const count = await ApmcDirectory.countDocuments({
          sourceType: adapter.sourceType,
        });
        baseHealth.recordsInDatabase = count;
      } else if (adapter.sourceType === "krishisetu_buyers") {
        const { Business } = await import("../../models/Business");
        const { BuyerOffer } = await import("../../models/BuyerOffer");
        const businessCount = await Business.countDocuments({ isActive: true });
        const offerCount = await BuyerOffer.countDocuments({ status: "active" });
        baseHealth.recordsInDatabase = businessCount + offerCount;
      }

      // Determine overall status
      if (!baseHealth.isConfigured) {
        baseHealth.status = "unconfigured";
      } else if (baseHealth.mostRecentRecordDate) {
        const daysSinceUpdate = (Date.now() - baseHealth.mostRecentRecordDate.getTime()) / (1000 * 60 * 60 * 24);
        baseHealth.status = daysSinceUpdate > 7 ? "stale" : "healthy";
      }

      return baseHealth;
    });

    return Promise.all(healthPromises);
  }
}

// Singleton instance
export const sourceManager = new SourceManager();
