/**
 * Source E: KrishiSetu Registered Buyers Adapter
 *
 * This adapter manages the application's own registered buyer/business directory.
 * It interacts with the Business and BuyerOffer models to provide:
 * - Registered business listings
 * - Active crop-buying offers
 * - Verification status tracking
 *
 * All records are stored persistently in MongoDB.
 * Business owners can create, update, and pause their own listings.
 */

import { Business } from "../../models/Business";
import { BuyerOffer } from "../../models/BuyerOffer";
import {
  SourceAdapter,
  SourceSyncResult,
  SourceHealth,
  SourceType,
} from "./types";

export class KrishiSetuBuyersAdapter implements SourceAdapter {
  sourceType: SourceType = "krishisetu_buyers";
  sourceName = "KrishiSetu Registered Buyers";

  isConfigured(): boolean {
    return true; // Always available for internal database
  }

  async sync(): Promise<SourceSyncResult> {
    // This source doesn't need sync - it's the internal database
    // However, we can perform maintenance tasks like expiring old offers
    const retrievedAt = new Date();

    try {
      // Expire offers that have passed their expiry date
      const expiredCount = await BuyerOffer.updateMany(
        {
          status: "active",
          expiryDate: { $lt: new Date() },
        },
        {
          $set: { status: "expired" },
        }
      );

      // Count active businesses and offers
      const activeBusinesses = await Business.countDocuments({ isActive: true });
      const activeOffers = await BuyerOffer.countDocuments({ status: "active" });

      return {
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        status: "success",
        recordsFetched: activeBusinesses + activeOffers,
        recordsInserted: 0,
        recordsSkipped: 0,
        recordsUpdated: expiredCount.modifiedCount || 0,
        retrievedAt,
        message: `Maintenance complete: ${activeBusinesses} active businesses, ${activeOffers} active offers, ${expiredCount.modifiedCount || 0} offers expired`,
      };
    } catch (error: any) {
      console.error("❌ [KrishiSetu Buyers Sync Error]:", error?.message);
      return {
        sourceType: this.sourceType,
        sourceName: this.sourceName,
        status: "failed",
        recordsFetched: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        recordsUpdated: 0,
        retrievedAt,
        message: error?.message || "Failed to perform maintenance",
        errorDetails: error?.stack,
      };
    }
  }

  async getActiveBuyers(options: {
    state?: string;
    district?: string;
    crop?: string;
    verifiedOnly?: boolean;
    limit?: number;
  } = {}): Promise<any[]> {
    const { state, district, crop, verifiedOnly = false, limit = 50 } = options;

    const query: any = {
      isActive: true,
      consentToPublish: true,
    };

    if (state) {
      query.state = { $regex: new RegExp(state, "i") };
    }

    if (district) {
      query.$or = [
        { district: { $regex: new RegExp(district, "i") } },
        { serviceDistricts: { $regex: new RegExp(district, "i") } },
        { serviceCoverage: "statewide" },
      ];
    }

    if (verifiedOnly) {
      query.verificationStatus = "verified";
    }

    const businesses = await Business.find(query)
      .limit(limit)
      .populate("ownerId", "name email")
      .lean();

    // Get active offers for each business
    const businessIds = businesses.map((b) => b._id);
    const offers = await BuyerOffer.find({
      businessId: { $in: businessIds },
      status: "active",
      expiryDate: { $gt: new Date() },
    }).lean();

    const offersByBusiness: Record<string, any[]> = {};
    for (const offer of offers) {
      const bId = offer.businessId.toString();
      if (!offersByBusiness[bId]) offersByBusiness[bId] = [];
      offersByBusiness[bId].push(offer);
    }

    return businesses.map((business) => ({
      ...business,
      activeOffers: offersByBusiness[business._id.toString()] || [],
      bestOfferPricePerKg:
        offersByBusiness[business._id.toString()]?.length > 0
          ? Math.max(...offersByBusiness[business._id.toString()].map((o) => o.pricePerKg))
          : null,
    }));
  }

  async getBuyerOffers(options: {
    businessId?: string;
    crop?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<any[]> {
    const { businessId, crop, status = "active", limit = 50 } = options;

    const query: any = { status };

    if (businessId) {
      query.businessId = businessId;
    }

    if (crop) {
      query.crop = { $regex: new RegExp(crop, "i") };
    }

    if (status === "active") {
      query.expiryDate = { $gt: new Date() };
    }

    return BuyerOffer.find(query)
      .limit(limit)
      .populate("businessId", "businessName phone district state verificationStatus")
      .lean();
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
}
