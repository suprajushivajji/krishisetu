import mongoose, { Schema, Document, Types } from "mongoose";

export type EnquiryStatus =
  | "submitted"
  | "viewed"
  | "offer_received"
  | "negotiating"
  | "accepted"
  | "rejected"
  | "completed"
  | "cancelled";

export interface IStatusHistory {
  status: EnquiryStatus;
  changedBy: Types.ObjectId;
  note?: string;
  timestamp: Date;
}

export interface IFarmerEnquiry extends Document {
  _id: Types.ObjectId;
  farmerId: Types.ObjectId;
  businessId: Types.ObjectId;
  offerId?: Types.ObjectId;
  crop: string;
  variety?: string;
  grade?: string;
  quantity: number;
  unit: string;
  expectedHarvestDate?: Date;
  pickupLocation: string;
  coordinatesConsent: boolean;
  message?: string;
  voiceTranscribed: boolean;
  status: EnquiryStatus;
  statusHistory: IStatusHistory[];
  buyerResponse?: {
    proposedPrice: number;
    acceptedQuantity: number;
    pickupArrangements: string;
    paymentTerms: string;
    offerValidityDate: Date;
    writtenNote?: string;
    respondedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FarmerEnquirySchema = new Schema<IFarmerEnquiry>(
  {
    farmerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", required: true },
    offerId: { type: Schema.Types.ObjectId, ref: "BuyerOffer" },
    crop: { type: String, required: true },
    variety: { type: String },
    grade: { type: String, default: "Grade A" },
    quantity: { type: Number, required: true },
    unit: { type: String, default: "kg" },
    expectedHarvestDate: { type: Date },
    pickupLocation: { type: String, required: true },
    coordinatesConsent: { type: Boolean, default: false },
    message: { type: String },
    voiceTranscribed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "submitted",
        "viewed",
        "offer_received",
        "negotiating",
        "accepted",
        "rejected",
        "completed",
        "cancelled",
      ],
      default: "submitted",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        note: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    buyerResponse: {
      proposedPrice: { type: Number },
      acceptedQuantity: { type: Number },
      pickupArrangements: { type: String },
      paymentTerms: { type: String },
      offerValidityDate: { type: Date },
      writtenNote: { type: String },
      respondedAt: { type: Date },
    },
  },
  { timestamps: true }
);

FarmerEnquirySchema.index({ farmerId: 1, createdAt: -1 });
FarmerEnquirySchema.index({ businessId: 1, status: 1, createdAt: -1 });

export const FarmerEnquiry =
  mongoose.models.FarmerEnquiry ||
  mongoose.model<IFarmerEnquiry>("FarmerEnquiry", FarmerEnquirySchema);
