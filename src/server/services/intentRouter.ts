/**
 * Intent Router for Voice Assistant
 * Classifies user questions and routes to appropriate data services
 */

import { MarketPrice } from "../models/MarketPrice";
import { Market } from "../models/Market";
import { Business } from "../models/Business";
import { BuyerOffer } from "../models/BuyerOffer";
import { calculateNetReturn } from "../utils/calculator";

export type IntentType =
  | "crop_price"
  | "market_comparison"
  | "nearby_markets"
  | "buyer_search"
  | "buyer_contact"
  | "crop_price_trend"
  | "crop_price_prediction"
  | "sowing_guidance"
  | "harvest_guidance"
  | "crop_disease_information"
  | "weather_forecast"
  | "net_return_calculation"
  | "business_registration_help"
  | "general_agriculture_question"
  | "clarification_required";

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  crop?: string;
  district?: string;
  state?: string;
  quantity?: number;
  distance?: number;
  market?: string;
  missingFields: string[];
  data?: any;
}

export class IntentRouter {
  /**
   * Classify intent from transcript
   */
  static async classify(transcript: string, defaultDistrict: string, defaultState: string = "Karnataka"): Promise<IntentResult> {
    const lower = transcript.toLowerCase();

    // Get actual crops from database
    const actualCrops = await MarketPrice.distinct("commodity");
    const knownCrops = actualCrops.map((c) => c.toLowerCase());
    
    // Fallback to hardcoded list if DB is empty
    const fallbackCrops = ["tomato", "onion", "potato", "brinjal", "cabbage", "chilli", "maize", "wheat", "rice", "paddy"];
    const cropList = knownCrops.length > 0 ? knownCrops : fallbackCrops;
    
    // Detect crop - more precise matching (whole word match with word boundaries)
    let detectedCrop: string | undefined;
    for (const crop of cropList) {
      // Escape special regex characters in crop name
      const escapedCrop = crop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use word boundary regex to match whole words only
      const regex = new RegExp(`\\b${escapedCrop}\\b`, "i");
      if (regex.test(lower)) {
        detectedCrop = crop;
        break;
      }
    }

    const quantityMatch = lower.match(/(\d+(?:\.\d+)?)\s*(kg|quintal|ton|kg|ಕಿಲೋ|ಕೆಜಿ)/i);
    let quantity = quantityMatch ? this.normalizeToKg(Number(quantityMatch[1]), quantityMatch[2]) : undefined;

    const distanceMatch = lower.match(/(\d+(?:\.\d+)?)\s*(km|ಕಿಮೀ)/i);
    const distance = distanceMatch ? Number(distanceMatch[1]) : undefined;

    // Intent classification
    let intent: IntentType = "general_agriculture_question";
    let confidence = 0.5;
    const missingFields: string[] = [];

    // Price queries
    if (
      lower.includes("price") ||
      lower.includes("rate") ||
      lower.includes("ಬೆಲೆ") ||
      lower.includes("ದರ") ||
      lower.includes("ಭಾವ") ||
      lower.includes("ಕೂಲಿ")
    ) {
      if (lower.includes("predict") || lower.includes("forecast") || lower.includes("future")) {
        intent = "crop_price_prediction";
        confidence = 0.8;
      } else if (lower.includes("trend") || lower.includes("history") || lower.includes("last")) {
        intent = "crop_price_trend";
        confidence = 0.8;
      } else if (lower.includes("compare") || lower.includes("difference") || lower.includes("which market")) {
        intent = "market_comparison";
        confidence = 0.75;
      } else {
        intent = "crop_price";
        confidence = 0.9;
      }
    }

    // Buyer queries
    if (
      lower.includes("buyer") ||
      lower.includes("kharidi") ||
      lower.includes("ಖರೀದಿದಾರ") ||
      lower.includes("ವ್ಯಾಪಾರಿ") ||
      lower.includes("purchase") ||
      lower.includes("who will buy")
    ) {
      if (lower.includes("contact") || lower.includes("phone") || lower.includes("call")) {
        intent = "buyer_contact";
        confidence = 0.85;
      } else {
        intent = "buyer_search";
        confidence = 0.9;
      }
    }

    // Market queries
    if (
      lower.includes("market") ||
      lower.includes("ಮಂಡಿ") ||
      lower.includes("apmc") ||
      lower.includes("mandi") ||
      lower.includes("nearby market")
    ) {
      intent = "nearby_markets";
      confidence = 0.85;
    }

    // Earnings/calculation queries
    if (
      lower.includes("earnings") ||
      lower.includes("profit") ||
      lower.includes("ಲಾಭ") ||
      lower.includes("ಲೆಕ್ಕ") ||
      lower.includes("calculate") ||
      lower.includes("net return")
    ) {
      intent = "net_return_calculation";
      confidence = 0.9;
    }

    // Weather queries
    if (
      lower.includes("weather") ||
      lower.includes("rain") ||
      lower.includes("ಹವಾಮಾನ") ||
      lower.includes("ಮಳೆ") ||
      lower.includes("temperature")
    ) {
      intent = "weather_forecast";
      confidence = 0.9;
    }

    // Agricultural guidance
    if (
      lower.includes("sow") ||
      lower.includes("plant") ||
      lower.includes("ಬಿತ್ತ") ||
      lower.includes("ನೆಡುವುದು") ||
      lower.includes("grow")
    ) {
      intent = "sowing_guidance";
      confidence = 0.8;
    }

    if (
      lower.includes("harvest") ||
      lower.includes("ಕೊಯ್ಲು") ||
      lower.includes("ಕಟಾವು")
    ) {
      intent = "harvest_guidance";
      confidence = 0.8;
    }

    // Determine missing fields - be more lenient
    if (!detectedCrop && ["crop_price", "crop_price_prediction", "crop_price_trend", "buyer_search", "buyer_contact"].includes(intent)) {
      // Only ask for crop if intent specifically requires it
      if (intent === "crop_price" || intent === "crop_price_prediction" || intent === "crop_price_trend") {
        missingFields.push("crop");
      }
    }

    if (!quantity && intent === "net_return_calculation") {
      // Use default quantity if not specified
      quantity = 500; // Default 500kg
    }

    if (missingFields.length > 0) {
      intent = "clarification_required";
      confidence = 0.7;
    }

    return {
      intent,
      confidence,
      crop: detectedCrop,
      district: defaultDistrict,
      state: defaultState,
      quantity,
      distance,
      missingFields,
    };
  }

  /**
   * Execute intent and retrieve data
   */
  static async execute(intentResult: IntentResult): Promise<any> {
    const { intent, crop, district, state, quantity, distance } = intentResult;

    // Use default values if not specified
    const finalCrop = crop || "Tomato"; // Default to tomato if not specified
    const finalQuantity = quantity || 500; // Default 500kg if not specified
    const finalDistrict = district || "Davanagere"; // Default district

    switch (intent) {
      case "crop_price":
        return this.getCropPrice(finalCrop, finalDistrict, state);

      case "market_comparison":
        return this.compareMarkets(finalCrop, finalDistrict, state);

      case "nearby_markets":
        return this.getNearbyMarkets(finalDistrict, state, distance);

      case "buyer_search":
        return this.searchBuyers(finalCrop, finalDistrict, state);

      case "buyer_contact":
        return this.getBuyerContact(finalCrop, finalDistrict, state);

      case "net_return_calculation":
        return this.calculateNetReturn(finalCrop, finalDistrict, state, finalQuantity, distance);

      case "crop_price_trend":
        return this.getPriceTrend(finalCrop, finalDistrict, state);

      case "crop_price_prediction":
        return this.predictPrice(finalCrop, finalDistrict, state);

      case "weather_forecast":
        return this.getWeatherForecast(finalDistrict, state);

      default:
        return { error: "Intent not implemented yet" };
    }
  }

  private static async getCropPrice(crop?: string, district?: string, state?: string) {
    if (!crop) return { error: "Crop not specified" };

    // Try district-specific search first
    let filter: any = { commodity: { $regex: new RegExp(crop, "i") } };
    if (district) filter.district = { $regex: new RegExp(district, "i") };
    else if (state) filter.state = { $regex: new RegExp(state, "i") };

    let price = await MarketPrice.findOne(filter).sort({ arrivalDate: -1 });

    // If no district match, try statewide
    if (!price && district) {
      filter = { commodity: { $regex: new RegExp(crop, "i") } };
      if (state) filter.state = { $regex: new RegExp(state, "i") };
      price = await MarketPrice.findOne(filter).sort({ arrivalDate: -1 });
    }

    // If still no match, try any state
    if (!price) {
      filter = { commodity: { $regex: new RegExp(crop, "i") } };
      price = await MarketPrice.findOne(filter).sort({ arrivalDate: -1 });
    }

    if (!price) {
      // Get available crops to help the user
      const availableCrops = await MarketPrice.distinct("commodity");
      const sampleCrops = availableCrops.slice(0, 10).join(", ");
      return {
        found: false,
        message: `No price record found for ${crop}. Available crops in database: ${sampleCrops}...`,
        availableCrops: sampleCrops,
      };
    }

    return {
      found: true,
      crop: price.commodity,
      market: price.market,
      district: price.district,
      state: price.state,
      modalPricePerKg: price.modalPricePerKg,
      minPricePerKg: price.minPrice / 100,
      maxPricePerKg: price.maxPrice / 100,
      arrivalDate: price.arrivalDate,
      source: price.source,
    };
  }

  private static async compareMarkets(crop?: string, district?: string, state?: string) {
    if (!crop) return { error: "Crop not specified" };

    const filter: any = { commodity: { $regex: new RegExp(crop, "i") } };
    if (state) filter.state = { $regex: new RegExp(state, "i") };

    const prices = await MarketPrice.find(filter)
      .sort({ arrivalDate: -1, modalPricePerKg: -1 })
      .limit(10)
      .lean();

    if (prices.length === 0) {
      return {
        found: false,
        message: `No price records found for ${crop}`,
      };
    }

    return {
      found: true,
      crop,
      markets: prices.map((p) => ({
        market: p.market,
        district: p.district,
        modalPricePerKg: p.modalPricePerKg,
        arrivalDate: p.arrivalDate,
      })),
    };
  }

  private static async getNearbyMarkets(district?: string, state?: string, distanceKm?: number) {
    const filter: any = {};
    if (district) filter.district = { $regex: new RegExp(district, "i") };
    else if (state) filter.state = { $regex: new RegExp(state, "i") };

    const markets = await Market.find(filter)
      .limit(20)
      .lean();

    return {
      found: markets.length > 0,
      count: markets.length,
      markets: markets.map((m) => ({
        name: m.name,
        marketType: m.marketType,
        district: m.district,
        address: m.fullAddress,
        phone: m.publicPhone,
        hasContact: Boolean(m.publicPhone),
      })),
    };
  }

  private static async searchBuyers(crop?: string, district?: string, state?: string) {
    const filter: any = { isActive: true, consentToPublish: true };
    if (crop) filter.cropsPurchased = { $regex: new RegExp(crop, "i") };
    if (district) {
      filter.$or = [
        { district: { $regex: new RegExp(district, "i") } },
        { serviceDistricts: district },
        { serviceCoverage: "statewide" },
      ];
    } else if (state) {
      filter.state = { $regex: new RegExp(state, "i") };
    }

    const businesses = await Business.find(filter).limit(10).lean();

    return {
      found: businesses.length > 0,
      count: businesses.length,
      buyers: businesses.map((b) => ({
        name: b.businessName,
        category: b.category,
        district: b.district,
        phone: b.phone,
        verified: b.verificationStatus === "verified",
      })),
    };
  }

  private static async getBuyerContact(crop?: string, district?: string, state?: string) {
    const searchResult = await this.searchBuyers(crop, district, state);
    return searchResult;
  }

  private static async calculateNetReturn(crop?: string, district?: string, state?: string, quantityKg?: number, distanceKm?: number) {
    // Use default crop if not specified
    const finalCrop = crop || "Maize"; // Default to Maize if not specified
    const finalQuantity = quantityKg || 500;
    const finalDistance = distanceKm || 0;

    const priceResult = await this.getCropPrice(finalCrop, district, state);

    if (!priceResult.found) {
      return {
        error: "Cannot calculate without current price",
        priceResult,
        suggestedCrop: finalCrop,
      };
    }

    const calculation = calculateNetReturn({
      pricePerKg: priceResult.modalPricePerKg,
      quantityKg: finalQuantity,
      distanceKm: finalDistance,
      handlingCostPerKg: 1.2,
    });

    return {
      calculation,
      priceData: priceResult,
      quantityKg: finalQuantity,
      distanceKm: finalDistance,
      cropUsed: finalCrop,
    };
  }

  private static async getPriceTrend(crop?: string, district?: string, state?: string) {
    if (!crop) return { error: "Crop not specified" };

    const filter: any = { commodity: { $regex: new RegExp(crop, "i") } };
    if (district) filter.district = { $regex: new RegExp(district, "i") };

    const prices = await MarketPrice.find(filter)
      .sort({ arrivalDate: 1 })
      .limit(30)
      .lean();

    if (prices.length < 2) {
      return {
        found: false,
        message: "Insufficient historical data for trend analysis",
        availableCount: prices.length,
        observations: prices.length,
      };
    }

    const firstPrice = prices[0].modalPricePerKg;
    const lastPrice = prices[prices.length - 1].modalPricePerKg;
    const change = lastPrice - firstPrice;
    const percentChange = (change / firstPrice) * 100;

    return {
      found: true,
      crop,
      startDate: prices[0].arrivalDate,
      endDate: prices[prices.length - 1].arrivalDate,
      observations: prices.length,
      firstPrice,
      lastPrice,
      change,
      percentChange,
      trend: percentChange > 5 ? "increasing" : percentChange < -5 ? "decreasing" : "stable",
    };
  }

  private static async predictPrice(crop?: string, district?: string, state?: string) {
    // Check historical data sufficiency
    const trendResult = await this.getPriceTrend(crop, district, state);

    if (!trendResult.found || (trendResult.observations !== undefined && trendResult.observations < 10)) {
      return {
        sufficiencyStatus: "insufficient",
        message: "Insufficient historical data for reliable prediction",
        availableObservations: trendResult.observations || 0,
        required: 10,
        recommendation: "Check current market prices instead",
      };
    }

    // Simple baseline prediction: last observed value
    return {
      sufficiencyStatus: "partial",
      forecastValue: trendResult.lastPrice,
      forecastHorizon: 7, // 7 days
      modelUsed: "baseline_last_observed",
      limitations: [
        "This is a simple baseline using the last observed price",
        "More data required for sophisticated forecasting",
        "Consider market volatility and external factors",
      ],
      recommendation: "Use as reference only, not guaranteed",
    };
  }

  private static async getWeatherForecast(district?: string, state?: string) {
    // Open-Meteo integration would go here
    return {
      sufficiencyStatus: "insufficient",
      message: "Weather service not yet configured",
      location: district || state,
    };
  }

  private static normalizeToKg(value: number, unit: string): number {
    const normalizedUnit = unit.toLowerCase();
    if (normalizedUnit.includes("quintal")) return value * 100;
    if (normalizedUnit.includes("ton")) return value * 1000;
    return value; // assume kg
  }
}
