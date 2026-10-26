import mongoose, { Schema, Document, Types } from "mongoose";

// Crop Reference Schema
export interface ICrop extends Document {
  _id: Types.ObjectId;
  name: string; // e.g. "Tomato"
  nameKannada: string; // "ಟೊಮೇಟೊ"
  category: "vegetables" | "grains" | "pulses" | "fruits" | "spices" | "oilseeds";
  varieties: string[];
  defaultUnit: string;
  perishableDays: number;
}

const CropSchema = new Schema<ICrop>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    nameKannada: { type: String, required: true, trim: true },
    category: { type: String, default: "vegetables" },
    varieties: [{ type: String }],
    defaultUnit: { type: String, default: "kg" },
    perishableDays: { type: Number, default: 7 },
  },
  { timestamps: true }
);

export const Crop = mongoose.models.Crop || mongoose.model<ICrop>("Crop", CropSchema);

// Report Schema
export interface IReport extends Document {
  _id: Types.ObjectId;
  reportedBy: Types.ObjectId;
  targetType: "business" | "offer" | "user";
  targetId: Types.ObjectId;
  reason: string;
  details?: string;
  status: "pending" | "reviewed" | "dismissed" | "action_taken";
  reviewedBy?: Types.ObjectId;
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["business", "offer", "user"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true },
    details: { type: String },
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed", "action_taken"],
      default: "pending",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Report = mongoose.models.Report || mongoose.model<IReport>("Report", ReportSchema);

// Notification Schema
export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  titleKannada?: string;
  message: string;
  messageKannada?: string;
  type: "enquiry" | "offer" | "price_alert" | "system";
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    titleKannada: { type: String },
    message: { type: String, required: true },
    messageKannada: { type: String },
    type: { type: String, enum: ["enquiry", "offer", "price_alert", "system"], default: "system" },
    link: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

// Audit Log Schema
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId;
  action: string;
  targetResource: string;
  targetResourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    targetResource: { type: String, required: true },
    targetResourceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

// Export additional models
export { Market } from "./Market";
export { CropPrediction } from "./CropPrediction";
