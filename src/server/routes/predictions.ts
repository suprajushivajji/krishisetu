/**
 * Crop Price Prediction API Routes
 * POST /api/v1/predictions/crop-price
 * GET /api/v1/predictions/history
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { CropPredictionService } from "../services/cropPrediction";

export const predictionRouter = Router();

const predictSchema = z.object({
  crop: z.string().min(2, "Crop name is required"),
  variety: z.string().optional(),
  state: z.string().min(2, "State is required"),
  district: z.string().min(2, "District is required"),
  market: z.string().optional(),
  forecastHorizon: z.coerce.number().int().positive().max(30).default(7),
});

/**
 * POST /api/v1/predictions/crop-price
 * Generate a price prediction
 */
predictionRouter.post("/crop-price", async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = predictSchema.parse(req.body);

    const result = await CropPredictionService.predict(validated);

    res.status(200).json({
      success: true,
      prediction: result,
    });
  } catch (error: any) {
    console.error("❌ Prediction error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to generate prediction" });
  }
});

/**
 * GET /api/v1/predictions/history
 * Get prediction history
 */
predictionRouter.get("/history", async (req: Request, res: Response): Promise<void> => {
  try {
    const { crop, state, district, limit } = req.query;

    const history = await CropPredictionService.getHistory({
      crop: crop as string,
      state: state as string,
      district: district as string,
      limit: limit ? Number(limit) : 20,
    });

    res.status(200).json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error: any) {
    console.error("❌ Prediction history error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch prediction history" });
  }
});
