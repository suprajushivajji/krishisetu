/**
 * Crop Price Prediction Service
 * Uses historical price data to generate forecasts
 * Distinguishes between historical observations and predictions
 */

import { MarketPrice } from "../models/MarketPrice";
import { CropPrediction } from "../models/CropPrediction";

export interface PredictionRequest {
  crop: string;
  variety?: string;
  state: string;
  district: string;
  market?: string;
  forecastHorizon?: number; // days
}

export interface PredictionResult {
  crop: string;
  variety?: string;
  state: string;
  district: string;
  market?: string;
  forecastHorizon: number;
  historicalObservationsUsed: number;
  dataCutoffDate: Date;
  forecastValue?: number;
  forecastRange?: { min: number; max: number };
  modelUsed: string;
  evaluationMetrics?: { mae?: number; rmse?: number; mape?: number };
  confidenceInterval?: { lower: number; upper: number };
  sufficiencyStatus: "sufficient" | "insufficient" | "partial";
  limitations: string[];
  lastObservedPrice?: number;
  lastObservedDate?: Date;
}

export class CropPredictionService {
  private static readonly MIN_OBSERVATIONS = 10;
  private static readonly DEFAULT_HORIZON = 7; // 7 days

  /**
   * Generate a price prediction
   */
  static async predict(request: PredictionRequest): Promise<PredictionResult> {
    const { crop, variety, state, district, market, forecastHorizon = this.DEFAULT_HORIZON } = request;

    // Fetch historical data
    const filter: any = {
      commodity: { $regex: new RegExp(crop, "i") },
      state: { $regex: new RegExp(state, "i") },
      district: { $regex: new RegExp(district, "i") },
    };

    if (market) {
      filter.market = { $regex: new RegExp(market, "i") };
    }

    const historicalData = await MarketPrice.find(filter)
      .sort({ arrivalDate: 1 })
      .lean();

    const observationsUsed = historicalData.length;
    const dataCutoffDate = historicalData.length > 0 ? historicalData[historicalData.length - 1].arrivalDate : new Date();

    // Check data sufficiency
    if (observationsUsed < this.MIN_OBSERVATIONS) {
      const result: PredictionResult = {
        crop,
        variety,
        state,
        district,
        market,
        forecastHorizon,
        historicalObservationsUsed: observationsUsed,
        dataCutoffDate,
        modelUsed: "none",
        sufficiencyStatus: "insufficient",
        limitations: [
          `Only ${observationsUsed} historical observations available`,
          `Minimum ${this.MIN_OBSERVATIONS} observations required for forecasting`,
          "Consider accumulating more historical data",
        ],
      };

      if (observationsUsed > 0) {
        const last = historicalData[historicalData.length - 1];
        result.lastObservedPrice = last.modalPricePerKg;
        result.lastObservedDate = last.arrivalDate;
      }

      // Store prediction result
      await this.storePrediction(result);

      return result;
    }

    // Simple baseline model: last observed value
    const lastPrice = historicalData[historicalData.length - 1].modalPricePerKg;
    const lastDate = historicalData[historicalData.length - 1].arrivalDate;

    // Calculate simple statistics
    const prices = historicalData.map((p) => p.modalPricePerKg);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const std = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length);

    // Baseline forecast: last observed value
    const forecastValue = lastPrice;
    const forecastRange = {
      min: Math.max(0, lastPrice - std),
      max: lastPrice + std,
    };

    const result: PredictionResult = {
      crop,
      variety,
      state,
      district,
      market,
      forecastHorizon,
      historicalObservationsUsed: observationsUsed,
      dataCutoffDate,
      forecastValue,
      forecastRange,
      modelUsed: "baseline_last_observed",
      sufficiencyStatus: "partial",
      limitations: [
        "This is a simple baseline using the last observed price",
        "No sophisticated time-series model applied",
        "Does not account for seasonality, external factors, or market volatility",
        "Use as reference only, not a guaranteed future price",
      ],
      lastObservedPrice: lastPrice,
      lastObservedDate: lastDate,
    };

    // Store prediction
    await this.storePrediction(result);

    return result;
  }

  /**
   * Get prediction history
   */
  static async getHistory(options: {
    crop?: string;
    state?: string;
    district?: string;
    limit?: number;
  }) {
    const { crop, state, district, limit = 20 } = options;

    const filter: any = {};
    if (crop) filter.crop = { $regex: new RegExp(crop, "i") };
    if (state) filter.state = { $regex: new RegExp(state, "i") };
    if (district) filter.district = { $regex: new RegExp(district, "i") };

    const predictions = await CropPrediction.find(filter)
      .sort({ predictionTimestamp: -1 })
      .limit(limit)
      .lean();

    return predictions;
  }

  /**
   * Store prediction in database
   */
  private static async storePrediction(result: PredictionResult): Promise<void> {
    await CropPrediction.create({
      crop: result.crop,
      variety: result.variety,
      state: result.state,
      district: result.district,
      market: result.market,
      forecastHorizon: result.forecastHorizon,
      historicalObservationsUsed: result.historicalObservationsUsed,
      dataCutoffDate: result.dataCutoffDate,
      forecastValue: result.forecastValue,
      forecastRange: result.forecastRange,
      modelUsed: result.modelUsed,
      evaluationMetrics: result.evaluationMetrics,
      confidenceInterval: result.confidenceInterval,
      sufficiencyStatus: result.sufficiencyStatus,
      limitations: result.limitations,
    });
  }
}
