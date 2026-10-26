import mongoose, { Schema, Document, Types } from "mongoose";

export interface IFarmerProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  farmName?: string;
  state: string;
  district: string;
  taluk?: string;
  village?: string;
  locationConsent: boolean;
  coordinates?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  primaryCrops: string[];
  totalAcreage?: number;
  voiceConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FarmerProfileSchema = new Schema<IFarmerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    farmName: { type: String, trim: true },
    state: { type: String, required: true, default: "Karnataka" },
    district: { type: String, required: true, default: "Davanagere" },
    taluk: { type: String, trim: true },
    village: { type: String, trim: true },
    locationConsent: { type: Boolean, default: false },
    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: undefined,
      },
    },
    primaryCrops: [{ type: String }],
    totalAcreage: { type: Number },
    voiceConsent: { type: Boolean, default: true },
  },
  { timestamps: true }
);

FarmerProfileSchema.index({ "coordinates": "2dsphere" });
FarmerProfileSchema.index({ district: 1, state: 1 });

export const FarmerProfile =
  mongoose.models.FarmerProfile ||
  mongoose.model<IFarmerProfile>("FarmerProfile", FarmerProfileSchema);
