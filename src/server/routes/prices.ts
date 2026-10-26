import { Router, Request, Response } from "express";
import { z } from "zod";
import { MarketPrice } from "../models/MarketPrice";
import { BuyerOffer } from "../models/BuyerOffer";
import { Business } from "../models/Business";
import { authenticate, AuthenticatedRequest, authorizeRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  calculateNetReturn,
  normalizePriceToPerKg,
  normalizeToKg,
} from "../utils/calculator";
import { MandiPriceService } from "../services/mandi";

export const priceRouter = Router();

const districtCoordinates: Record<string, [number, number]> = {
  chamarajanagar: [11.9261, 76.9437],
  davanagere: [14.4644, 75.9218],
  dharwad: [15.4589, 75.0078],
  haveri: [14.7951, 75.3991],
  gadag: [15.4297, 75.6297],
  belagavi: [15.8497, 74.4977],
  shivamogga: [13.9299, 75.5681],
  mandya: [12.5218, 76.8951],
  mysuru: [12.2958, 76.6394],
  bengaluru: [12.9716, 77.5946],
};

function districtDistanceKm(district: string | undefined, lat: number, lng: number): number | null {
  if (!district) return null;
  const point = districtCoordinates[district.toLowerCase().trim()];
  if (!point) return null;
  const radians = Math.PI / 180;
  const deltaLat = (point[0] - lat) * radians;
  const deltaLng = (point[1] - lng) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat * radians) * Math.cos(point[0] * radians) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const compareSchema = z.object({
  crop: z.string().min(2),
  variety: z.string().optional(),
  grade: z.string().default("Grade A"),
  quantity: z.number().positive(),
  unit: z.string().default("kg"),
  quotedPrice: z.number().positive(),
  quotedUnit: z.string().default("kg"),
  district: z.string().default("Davanagere"),
  state: z.string().default("Karnataka"),
  distanceKm: z.number().optional().default(0),
  handlingCostPerKg: z.number().optional().default(1.2),
});

const netReturnSchema = z.object({
  pricePerKg: z.number().positive(),
  quantityKg: z.number().positive(),
  distanceKm: z.number().optional().default(0),
  handlingCostPerKg: z.number().optional().default(1.2),
  transportRatePerKmPerTon: z.number().optional().default(15),
  additionalCosts: z.number().optional().default(0),
});

/**
 * GET /api/v1/prices
 * Query Mandi benchmark records with statewide discovery
 */
priceRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { crop, district, state, sortBy = "date", limit = 50 } = req.query;
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const limitNum = Math.min(Number(limit), 200);

    const stateFilter: any = {};

    if (crop) stateFilter.commodity = { $regex: new RegExp(String(crop), "i") };
    if (state) stateFilter.state = { $regex: new RegExp(String(state), "i") };

    // Default to Karnataka if no state specified
    const searchState = state || "Karnataka";
    stateFilter.state = { $regex: new RegExp(String(searchState), "i") };

    let prices: any[] = [];
    let scope: "district" | "state" = district ? "district" : "state";

    if (district) {
      // Try district-specific search first
      const districtFilter = { ...stateFilter, district: { $regex: new RegExp(String(district), "i") } };
      prices = await MarketPrice.find(districtFilter)
        .sort({ arrivalDate: -1 })
        .limit(limitNum)
        .lean();

      // If no district results, fall back to statewide
      if (prices.length === 0) {
        prices = await MarketPrice.find(stateFilter)
          .sort({ arrivalDate: -1 })
          .limit(limitNum * 5) // Get more for statewide
          .lean();
        scope = "state";
      }
    } else {
      // Statewide search (default behavior)
      prices = await MarketPrice.find(stateFilter)
        .sort({ arrivalDate: -1 })
        .limit(limitNum * 5)
        .lean();
    }

    // Apply sorting
    if (sortBy === "price") {
      prices.sort((a, b) => b.modalPrice - a.modalPrice);
    } else if (sortBy === "distance" && lat !== null && lng !== null) {
      prices.sort((first, second) => {
        const firstDistance = districtDistanceKm(first.district, lat, lng) ?? Number.POSITIVE_INFINITY;
        const secondDistance = districtDistanceKm(second.district, lat, lng) ?? Number.POSITIVE_INFINITY;
        return firstDistance - secondDistance;
      });
    }
    // Default: date (already sorted)

    // Limit after sorting
    prices = prices.slice(0, limitNum);

    res.status(200).json({
      success: true,
      count: prices.length,
      scope,
      state: searchState,
      district: district || undefined,
      fallbackMessage: scope === "state" && district ? `No ${crop || "crop"} record was published in ${district}; showing available records from ${searchState}.` : undefined,
      prices,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch prices" });
  }
});

/**
 * GET /api/v1/prices/trends
 */
priceRouter.get("/trends", async (req: Request, res: Response): Promise<void> => {
  try {
    const { crop = "Tomato", district = "Davanagere" } = req.query;

    const trends = await MarketPrice.find({
      commodity: { $regex: new RegExp(String(crop), "i") },
      district: { $regex: new RegExp(String(district), "i") },
    })
      .sort({ arrivalDate: 1 })
      .limit(30)
      .select("market commodity modalPrice modalPricePerKg arrivalDate source");

    res.status(200).json({ success: true, count: trends.length, trends });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch trends" });
  }
});

/**
 * GET /api/v1/prices/status
 * Source health and freshness for price data
 */
priceRouter.get("/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const { source } = req.query;

    const filter: any = {};
    if (source) filter.source = source;

    const totalRecords = await MarketPrice.countDocuments(filter);
    const latestRecord = await MarketPrice.findOne(filter)
      .sort({ arrivalDate: -1 })
      .select("arrivalDate source retrievedAt");

    const sourceGroups = await MarketPrice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          latestArrival: { $max: "$arrivalDate" },
          latestRetrieval: { $max: "$retrievedAt" },
        },
      },
    ]);

    const sources = sourceGroups.map((group) => ({
      source: group._id,
      records: group.count,
      latestArrivalDate: group.latestArrival,
      latestRetrievalAt: group.latestRetrieval,
      isStale: group.latestRetrieval
        ? (Date.now() - group.latestRetrieval.getTime()) / (1000 * 60 * 60 * 24) > 7
        : false,
    }));

    res.status(200).json({
      success: true,
      totalRecords,
      latestRecord: latestRecord
        ? {
            arrivalDate: latestRecord.arrivalDate,
            source: latestRecord.source,
            retrievedAt: latestRecord.retrievedAt,
          }
        : null,
      sources,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch price status" });
  }
});

/**
 * GET /api/v1/prices/filters
 * Available state, district, market and crop filters
 */
priceRouter.get("/filters", async (req: Request, res: Response): Promise<void> => {
  try {
    const states = await MarketPrice.distinct("state");
    const districts = await MarketPrice.distinct("district");
    const markets = await MarketPrice.distinct("market");
    const commodities = await MarketPrice.distinct("commodity");

    res.status(200).json({
      success: true,
      filters: {
        states: states.sort(),
        districts: districts.sort(),
        markets: markets.sort(),
        commodities: commodities.sort(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch filters" });
  }
});

/**
 * POST /api/v1/prices/sync
 * Admin only trigger for data.gov.in AGMARKNET sync
 */
priceRouter.post(
  "/sync",
  authenticate,
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const syncResult = await MandiPriceService.syncMarketPrices(100);
      res.status(200).json({ success: true, syncResult });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Sync failed" });
    }
  }
);

/**
 * POST /api/v1/fair-price/compare
 * Compare farmer's quoted offer with benchmarks and active buyers
 */
priceRouter.post(
  "/fair-price/compare",
  validateBody(compareSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        crop,
        grade,
        quantity,
        unit,
        quotedPrice,
        quotedUnit,
        district,
        state,
        distanceKm,
        handlingCostPerKg,
      } = req.body;

      const quantityKg = normalizeToKg(quantity, unit);
      const quotedPricePerKg = normalizePriceToPerKg(quotedPrice, quotedUnit);

      // 1. Fetch benchmark price record from AGMARKNET
      const mandiBenchmark = await MarketPrice.findOne({
        commodity: { $regex: new RegExp(crop, "i") },
        district: { $regex: new RegExp(district, "i") },
      }).sort({ arrivalDate: -1 });

      if (!mandiBenchmark) {
        res.status(424).json({
          success: false,
          message: "No live market benchmark is available for this crop and district.",
          dataQualityNotes: ["The data.gov.in source did not return a comparable record."],
        });
        return;
      }

      const benchmarkPricePerKg = mandiBenchmark.modalPricePerKg;

      // 2. Calculate Farmer's estimated net return with current quote
      const quoteNetReturn = calculateNetReturn({
        pricePerKg: quotedPricePerKg,
        quantityKg,
        distanceKm,
        handlingCostPerKg,
      });

      // 3. Find top active verified buyer offers in the district
      const businesses = await Business.find({
        $or: [{ district: { $regex: new RegExp(district, "i") } }, { serviceDistricts: district }],
        isActive: true,
      }).select("_id businessName category phone address verificationStatus");

      const bIds = businesses.map((b) => b._id);
      const activeOffers = await BuyerOffer.find({
        businessId: { $in: bIds },
        crop: { $regex: new RegExp(crop, "i") },
        status: "active",
        expiryDate: { $gt: new Date() },
      })
        .populate("businessId", "businessName category phone verificationStatus district")
        .sort({ pricePerKg: -1 })
        .limit(5);

      const alternativeBuyers = activeOffers.map((offer: any) => {
        const estNet = calculateNetReturn({
          pricePerKg: offer.pricePerKg,
          quantityKg,
          distanceKm: 15, // approximate local distance
          handlingCostPerKg,
        });

        return {
          buyerId: offer.businessId?._id,
          buyerName: offer.businessId?.businessName,
          category: offer.businessId?.category,
          isVerified: offer.businessId?.verificationStatus === "verified",
          offeredPrice: offer.price,
          offeredUnit: offer.originalUnit,
          offeredPricePerKg: offer.pricePerKg,
          pickupConditions: offer.pickupConditions,
          estimatedTakeHome: estNet.estimatedNetReturn,
        };
      });

      const delta = Number((quotedPricePerKg - benchmarkPricePerKg).toFixed(2));
      const comparisonStatus =
        delta < -1
          ? "below_market"
          : delta > 1
          ? "above_market"
          : "within_market";

      res.status(200).json({
        success: true,
        crop,
        quantityKg,
        quotedPricePerKg,
        benchmark: {
          modalPricePerKg: benchmarkPricePerKg,
          source: mandiBenchmark.source,
          reportedDate: mandiBenchmark.arrivalDate,
          market: mandiBenchmark.market,
        },
        differencePerKg: delta,
        status: comparisonStatus,
        farmerNetReturn: quoteNetReturn,
        alternativeBuyers,
      });
    } catch (error: any) {
      console.error("❌ Fair price compare error:", error);
      res.status(500).json({ success: false, message: error.message || "Comparison calculation failed" });
    }
  }
);

/**
 * POST /api/v1/fair-price/net-return
 * Deterministic net return calculation endpoint
 */
priceRouter.post(
  "/fair-price/net-return",
  validateBody(netReturnSchema),
  (req: Request, res: Response): void => {
    try {
      const calculation = calculateNetReturn(req.body);
      res.status(200).json({ success: true, calculation });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);
