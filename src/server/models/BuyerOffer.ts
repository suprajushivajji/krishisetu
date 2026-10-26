import mongoose, { Schema, Document, Types } from "mongoose";

export interface IBuyerOffer extends Document {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  crop: string;
  variety?: string;
  grade?: string; // e.g. "Grade A", "Grade B", "Any"
  price: number;
  currency: string;
  originalUnit: string; // e.g. "kg", "quintal", "ton"
  pricePerKg: number; // normalized helper
  minQuantity: number;
  maxQuantity: number;
  quantityUnit: string;
  pickupConditions: "pickup_available" | "dropoff_required" | "negotiable";
  purchaseLocation: string;
  startDate: Date;
  expiryDate: Date;
  paymentTerms: string;
  status: "active" | "paused" | "expired" | "fulfilled" | "cancelled";
  lastPriceConfirmedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BuyerOfferSchema = new Schema<IBuyerOffer>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    crop: { type: String, required: true, trim: true },
    variety: { type: String, trim: true },
    grade: { type: String, default: "Grade A" },
    price: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    originalUnit: { type: String, default: "kg" },
    pricePerKg: { type: Number, required: true },
    minQuantity: { type: Number, default: 50 },
    maxQuantity: { type: Number, default: 5000 },
    quantityUnit: { type: String, default: "kg" },
    pickupConditions: {
      type: String,
      enum: ["pickup_available", "dropoff_required", "negotiable"],
      default: "pickup_available",
    },
    purchaseLocation: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    expiryDate: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
    paymentTerms: { type: String, default: "Immediate on collection" },
    status: {
      type: String,
      enum: ["active", "paused", "expired", "fulfilled", "cancelled"],
      default: "active",
    },
    lastPriceConfirmedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

BuyerOfferSchema.index({ crop: 1, status: 1, expiryDate: 1 });
BuyerOfferSchema.index({ businessId: 1, status: 1 });

export const BuyerOffer =
  mongoose.models.BuyerOffer ||
  mongoose.model<IBuyerOffer>("BuyerOffer", BuyerOfferSchema);
