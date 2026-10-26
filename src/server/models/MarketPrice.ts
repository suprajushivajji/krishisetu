import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMarketPrice extends Document {
  _id: Types.ObjectId;
  source: string; // e.g. "AGMARKNET (data.gov.in)"
  sourceRecordId?: string;
  sourceUrl?: string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  grade: string;
  arrivalDate: Date;
  reportedDate?: Date;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  originalUnit: string; // e.g. "Rs/Quintal"
  modalPricePerKg: number; // normalized
  retrievedAt: Date;
  verificationState: "official" | "verified_source" | "public_listing" | "registered" | "pending" | "unverified";
  isStale: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MarketPriceSchema = new Schema<IMarketPrice>(
  {
    source: { type: String, required: true, default: "AGMARKNET" },
    sourceRecordId: { type: String, trim: true },
    sourceUrl: { type: String, trim: true },
    state: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    market: { type: String, required: true, trim: true },
    commodity: { type: String, required: true, trim: true },
    variety: { type: String, default: "Common" },
    grade: { type: String, default: "FAQ" },
    arrivalDate: { type: Date, required: true },
    reportedDate: { type: Date },
    minPrice: { type: Number, required: true },
    maxPrice: { type: Number, required: true },
    modalPrice: { type: Number, required: true },
    originalUnit: { type: String, default: "Rs/Quintal" },
    modalPricePerKg: { type: Number, required: true },
    retrievedAt: { type: Date, default: Date.now },
    verificationState: {
      type: String,
      enum: ["official", "verified_source", "public_listing", "registered", "pending", "unverified"],
      default: "official",
    },
    isStale: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Idempotency compound index
MarketPriceSchema.index(
  { source: 1, state: 1, district: 1, market: 1, commodity: 1, arrivalDate: 1 },
  { unique: true }
);
MarketPriceSchema.index({ commodity: 1, arrivalDate: -1 });
MarketPriceSchema.index({ district: 1, commodity: 1 });

export const MarketPrice =
  mongoose.models.MarketPrice ||
  mongoose.model<IMarketPrice>("MarketPrice", MarketPriceSchema);
