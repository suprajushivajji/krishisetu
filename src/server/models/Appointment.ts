import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAppointment extends Document {
  _id: Types.ObjectId;
  appointmentId: string;
  farmerId?: Types.ObjectId;
  businessId?: Types.ObjectId;
  businessName?: string;
  purpose: string;
  scheduledDate: Date;
  scheduledTime: string;
  timezone: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "rejected";
  contactMethod: "phone" | "in_person" | "video_call";
  crop?: string;
  quantity?: number;
  enquiryId?: Types.ObjectId;
  notes?: string;
  confirmationHistory?: Array<{
    action: string;
    timestamp: Date;
    actor: "farmer" | "business" | "system";
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    appointmentId: { type: String, required: true, unique: true },
    farmerId: { type: Schema.Types.ObjectId, ref: "User" },
    businessId: { type: Schema.Types.ObjectId, ref: "Business" },
    businessName: { type: String },
    purpose: { type: String, required: true },
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "rejected"],
      default: "pending",
    },
    contactMethod: {
      type: String,
      enum: ["phone", "in_person", "video_call"],
      default: "phone",
    },
    crop: { type: String },
    quantity: { type: Number },
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry" },
    notes: { type: String },
    confirmationHistory: [
      {
        action: { type: String },
        timestamp: { type: Date, default: Date.now },
        actor: { type: String, enum: ["farmer", "business", "system"] },
      },
    ],
  },
  { timestamps: true }
);

AppointmentSchema.index({ appointmentId: 1 });
AppointmentSchema.index({ farmerId: 1, scheduledDate: -1 });
AppointmentSchema.index({ businessId: 1, scheduledDate: -1 });
AppointmentSchema.index({ status: 1 });

export const Appointment =
  mongoose.models.Appointment || mongoose.model<IAppointment>("Appointment", AppointmentSchema);
