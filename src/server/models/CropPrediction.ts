import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICropPrediction extends Document {
  _id: Types.ObjectId;
  crop: string;
  variety?: string;
  state: string;
  district: string;
  market?: string;
  forecastHorizon: number; // days
  historicalObservationsUsed: number;
  dataCutoffDate: Date;
  forecastValue?: number;
  forecastRange?: { min: number; max: number };
  modelUsed: string;
  evaluationMetrics?: { mae?: number; rmse?: number; mape?: number };
  confidenceInterval?: { lower: number; upper: number };
  predictionTimestamp: Date;
  sufficiencyStatus: "sufficient" | "insufficient" | "partial";
  limitations: string[];
  userId?: Types.ObjectId;
  createdAt: Date;
}

const CropPredictionSchema = new Schema<ICropPrediction>(
  {
    crop: { type: String, required: true, trim: true },
    variety: { type: String, trim: true },
    state: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    market: { type: String, trim: true },
    forecastHorizon: { type: Number, required: true },
    historicalObservationsUsed: { type: Number, required: true },
    dataCutoffDate: { type: Date, required: true },
    forecastValue: { type: Number },
    forecastRange: {
      min: { type: Number },
      max: { type: Number },
    },
    modelUsed: { type: String, required: true },
    evaluationMetrics: {
      mae: { type: Number },
      rmse: { type: Number },
      mape: { type: Number },
    },
    confidenceInterval: {
      lower: { type: Number },
      upper: { type: Number },
    },
    predictionTimestamp: { type: Date, default: Date.now },
    sufficiencyStatus: {
      type: String,
      enum: ["sufficient", "insufficient", "partial"],
      required: true,
    },
    limitations: [{ type: String }],
    userId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CropPredictionSchema.index({ crop: 1, state: 1, district: 1, predictionTimestamp: -1 });
CropPredictionSchema.index({ userId: 1, predictionTimestamp: -1 });

export const CropPrediction =
  mongoose.models.CropPrediction ||
  mongoose.model<ICropPrediction>("CropPrediction", CropPredictionSchema);
