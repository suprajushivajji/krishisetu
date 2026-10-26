import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMarket extends Document {
  _id: Types.ObjectId;
  name: string;
  marketType: string; // APMC, Rythu Bazar, Wholesale Market, etc.
  state: string;
  district: string;
  taluk?: string;
  locality?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  location?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  publicPhone?: string;
  publicEmail?: string;
  website?: string;
  officialSourceUrl?: string;
  sourceType: string; // official_directory, google_places, user_submitted
  sourceUpdatedAt?: Date;
  lastVerifiedAt?: Date;
  verificationStatus: "verified" | "pending" | "unverified";
  contactAvailability: "available" | "unavailable" | "restricted";
  geocodingStatus: "verified" | "approximate" | "unknown";
  openingHours?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MarketSchema = new Schema<IMarket>(
  {
    name: { type: String, required: true, trim: true },
    marketType: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    taluk: { type: String, trim: true },
    locality: { type: String, trim: true },
    fullAddress: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    location: {
      type: { type: String, enum: ["Point"], required: false },
      coordinates: { type: [Number], required: false },
    },
    publicPhone: { type: String, trim: true },
    publicEmail: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    officialSourceUrl: { type: String, trim: true },
    sourceType: { type: String, required: true, trim: true },
    sourceUpdatedAt: { type: Date },
    lastVerifiedAt: { type: Date },
    verificationStatus: {
      type: String,
      enum: ["verified", "pending", "unverified"],
      default: "unverified",
    },
    contactAvailability: {
      type: String,
      enum: ["available", "unavailable", "restricted"],
      default: "unavailable",
    },
    geocodingStatus: {
      type: String,
      enum: ["verified", "approximate", "unknown"],
      default: "unknown",
    },
    openingHours: { type: String, trim: true },
  },
  { timestamps: true }
);

// Indexes for fast querying
MarketSchema.index({ state: 1, district: 1, name: 1 });
MarketSchema.index({ location: "2dsphere" });
MarketSchema.index({ verificationStatus: 1 });
MarketSchema.index({ sourceType: 1 });

export const Market =
  mongoose.models.Market || mongoose.model<IMarket>("Market", MarketSchema);
