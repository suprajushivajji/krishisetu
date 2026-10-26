/**
 * Market Directory API Routes
 * GET /api/v1/markets - search market directory entries
 * GET /api/v1/markets/:id - market details
 * GET /api/v1/markets/:id/contact - market contact details
 * GET /api/v1/markets/map - geocoded markets for map display
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { ApmcDirectory } from "../services/marketSources/apmcDirectoryAdapter";
import { Market } from "../models/Market";
import { MarketPrice } from "../models/MarketPrice";
import { calculateHaversineDistanceKm } from "../utils/calculator";

export const marketRouter = Router();

const marketSearchSchema = z.object({
  state: z.string().optional(),
  district: z.string().optional(),
  market: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  page: z.coerce.number().int().positive().default(1),
});

/**
 * GET /api/v1/markets
 * Search market directory entries (APMCs, markets)
 */
marketRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { state, district, market, limit, page } = marketSearchSchema.parse(req.query);

    const filter: any = {};
    if (state) filter.state = { $regex: new RegExp(String(state), "i") };
    if (district) filter.district = { $regex: new RegExp(String(district), "i") };
    if (market) filter.marketName = { $regex: new RegExp(String(market), "i") };

    const skip = (page - 1) * limit;
    const markets = await ApmcDirectory.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ state: 1, district: 1, marketName: 1 })
      .lean();

    const total = await ApmcDirectory.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: markets.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      markets,
    });
  } catch (error: any) {
    console.error("❌ Market search error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to search markets" });
  }
});

/**
 * GET /api/v1/markets/:id
 * Get market details with available price data
 */
marketRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    // Try Market model first (new contact directory)
    let market = await Market.findById(req.params.id);

    // Fallback to ApmcDirectory if not found
    if (!market) {
      market = await ApmcDirectory.findById(req.params.id);
    }

    if (!market) {
      res.status(404).json({ success: false, message: "Market not found" });
      return;
    }

    // Fetch recent price data for this market
    const marketName = (market as any).marketName || (market as any).name;
    const recentPrices = await MarketPrice.find({
      state: market.state,
      district: market.district,
      market: marketName,
    })
      .sort({ arrivalDate: -1 })
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      market,
      recentPrices,
      priceCount: recentPrices.length,
    });
  } catch (error: any) {
    console.error("❌ Market details error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch market details" });
  }
});

/**
 * GET /api/v1/markets/:id/contact
 * Get market contact details specifically
 */
marketRouter.get("/:id/contact", async (req: Request, res: Response): Promise<void> => {
  try {
    const market = await Market.findById(req.params.id);

    if (!market) {
      res.status(404).json({ success: false, message: "Market not found" });
      return;
    }

    // Return only contact-relevant fields
    const contactInfo = {
      name: market.name,
      marketType: market.marketType,
      address: market.fullAddress,
      district: market.district,
      state: market.state,
      phone: market.publicPhone,
      email: market.publicEmail,
      website: market.website,
      openingHours: market.openingHours,
      contactAvailability: market.contactAvailability,
      verificationStatus: market.verificationStatus,
      lastVerifiedAt: market.lastVerifiedAt,
      sourceType: market.sourceType,
      hasPhone: Boolean(market.publicPhone),
      hasEmail: Boolean(market.publicEmail),
      hasWebsite: Boolean(market.website),
    };

    res.status(200).json({
      success: true,
      contact: contactInfo,
    });
  } catch (error: any) {
    console.error("❌ Market contact error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch contact details" });
  }
});

/**
 * GET /api/v1/markets/map
 * Get geocoded markets for map display
 */
marketRouter.get("/map", async (req: Request, res: Response): Promise<void> => {
  try {
    const { state, district, commodity, lat, lng } = req.query;

    const filter: any = {
      location: { $exists: true, $ne: null },
    };

    if (state) filter.state = { $regex: new RegExp(String(state), "i") };
    if (district) filter.district = { $regex: new RegExp(String(district), "i") };

    const markets = await ApmcDirectory.find(filter).lean();

    // If commodity is specified, fetch price data and compute distance
    let marketsWithPrices = markets;

    if (commodity) {
      const marketNames = markets.map((m) => m.marketName);
      const prices = await MarketPrice.find({
        commodity: { $regex: new RegExp(String(commodity), "i") },
        market: { $in: marketNames },
      })
        .sort({ arrivalDate: -1 })
        .lean();

      const pricesByMarket: Record<string, any> = {};
      for (const price of prices) {
        if (!pricesByMarket[price.market] || price.arrivalDate > pricesByMarket[price.market].arrivalDate) {
          pricesByMarket[price.market] = price;
        }
      }

      marketsWithPrices = markets.map((market) => ({
        ...market,
        latestPrice: pricesByMarket[market.marketName] || null,
      }));
    }

    // Compute distances if coordinates provided
    if (lat && lng) {
      const userLat = Number(lat);
      const userLng = Number(lng);

      marketsWithPrices = marketsWithPrices.map((market: any) => {
        if (market.location && market.location.coordinates) {
          const [lng, lat] = market.location.coordinates;
          const distanceKm = calculateHaversineDistanceKm(userLat, userLng, lat, lng);
          return {
            ...market,
            distanceKm: Number(distanceKm.toFixed(1)),
          };
        }
        return market;
      });

      // Sort by distance
      marketsWithPrices.sort((a: any, b: any) => {
        const distA = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const distB = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return distA - distB;
      });
    }

    res.status(200).json({
      success: true,
      count: marketsWithPrices.length,
      markets: marketsWithPrices,
    });
  } catch (error: any) {
    console.error("❌ Market map error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch map data" });
  }
});
