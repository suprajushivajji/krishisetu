import mongoose, { Schema, Document, Types } from "mongoose";

export type BusinessCategory =
  | "local_vendor"
  | "wholesaler"
  | "retailer"
  | "distributor"
  | "processor"
  | "exporter"
  | "cooperative"
  | "fpo"
  | "bulk_purchaser";

export type VerificationStatus = "pending" | "verified" | "rejected" | "suspended";

export interface IBusiness extends Document {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  businessName: string;
  category: BusinessCategory;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  locality?: string;
  taluk?: string;
  district: string;
  state: string;
  pincode?: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  cropsPurchased: string[]; // e.g., ["Tomato", "Onion", "Chilli"]
  cropVarieties?: string[];
  acceptableGrades?: string[]; // e.g. ["Grade A", "Grade B"]
  minQuantityKg?: number;
  maxQuantityKg?: number;
  preferredUnit: string; // e.g. "kg", "quintal", "ton"
  procurementFrequency?: string; // e.g. "daily", "weekly", "seasonal"
  transportPreference: "pickup" | "delivery" | "both";
  serviceCoverage: "village" | "taluk" | "district" | "multiple_districts" | "statewide";
  serviceDistricts: string[]; // list of districts served
  paymentMethods: string[]; // e.g. ["Cash", "UPI", "Bank Transfer"]
  paymentTerms: string; // e.g. "Immediate", "24 hours", "3 days"
  description?: string;
  documents?: string[];
  consentToPublish: boolean;
  verificationStatus: VerificationStatus;
  isActive: boolean;
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessName: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        "local_vendor",
        "wholesaler",
        "retailer",
        "distributor",
        "processor",
        "exporter",
        "cooperative",
        "fpo",
        "bulk_purchaser",
      ],
    },
    contactPerson: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    locality: { type: String, trim: true },
    taluk: { type: String, trim: true },
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, trim: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    cropsPurchased: [{ type: String, required: true }],
    cropVarieties: [{ type: String }],
    acceptableGrades: [{ type: String }],
    minQuantityKg: { type: Number, default: 50 },
    maxQuantityKg: { type: Number, default: 50000 },
    preferredUnit: { type: String, default: "kg" },
    procurementFrequency: { type: String, default: "daily" },
    transportPreference: {
      type: String,
      enum: ["pickup", "delivery", "both"],
      default: "pickup",
    },
    serviceCoverage: {
      type: String,
      enum: ["village", "taluk", "district", "multiple_districts", "statewide"],
      default: "district",
    },
    serviceDistricts: [{ type: String }],
    paymentMethods: [{ type: String, default: "Immediate Cash/UPI" }],
    paymentTerms: { type: String, default: "Immediate payment on delivery/pickup" },
    description: { type: String, trim: true },
    documents: [{ type: String }],
    consentToPublish: { type: Boolean, default: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected", "suspended"],
      default: "pending",
    },
    isActive: { type: Boolean, default: true },
    isDraft: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for fast querying & geospatial search
BusinessSchema.index({ location: "2dsphere" });
BusinessSchema.index({ district: 1, state: 1, isActive: 1 });
BusinessSchema.index({ cropsPurchased: 1, isActive: 1 });
BusinessSchema.index({ verificationStatus: 1 });

export const Business =
  mongoose.models.Business || mongoose.model<IBusiness>("Business", BusinessSchema);
