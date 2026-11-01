import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITranscriptSegment extends Document {
  _id: Types.ObjectId;
  speaker: "farmer" | "assistant";
  text: string;
  language: "kn-IN" | "hi-IN" | "en-IN";
  sequence: number;
  startTime: Date;
  endTime?: Date;
  isFinal: boolean;
  confidence?: number;
}

const TranscriptSegmentSchema = new Schema<ITranscriptSegment>(
  {
    speaker: { type: String, enum: ["farmer", "assistant"], required: true },
    text: { type: String, required: true },
    language: { type: String, enum: ["kn-IN", "hi-IN", "en-IN"], required: true },
    sequence: { type: Number, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    isFinal: { type: Boolean, default: false },
    confidence: { type: Number },
  },
  { _id: true }
);

export interface IMessageDelivery extends Document {
  _id: Types.ObjectId;
  provider: "whatsapp" | "sms" | "manual_whatsapp";
  recipientPhone: string;
  status: "pending" | "sent" | "delivered" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
  sentAt: Date;
  deliveredAt?: Date;
}

const MessageDeliverySchema = new Schema<IMessageDelivery>(
  {
    provider: { type: String, enum: ["whatsapp", "sms", "manual_whatsapp"], required: true },
    recipientPhone: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed"],
      default: "pending",
    },
    providerMessageId: { type: String },
    errorMessage: { type: String },
    sentAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
  },
  { _id: true }
);

export interface ICallSession extends Document {
  _id: Types.ObjectId;
  sessionId: string;
  userId?: Types.ObjectId;
  mode: "in_app" | "pstn";
  status: "created" | "connecting" | "active" | "completed" | "failed" | "cancelled";
  language: "kn-IN" | "hi-IN" | "en-IN";
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  transcriptSegments: ITranscriptSegment[];
  finalTranscript?: string;
  summary?: string;
  messageDeliveries: IMessageDelivery[];
  consentGiven: boolean;
  consentTimestamp?: Date;
  retentionDays: number;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    district?: string;
    state?: string;
  };
}

const CallSessionSchema = new Schema<ICallSession>(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    mode: { type: String, enum: ["in_app", "pstn"], default: "in_app" },
    status: {
      type: String,
      enum: ["created", "connecting", "active", "completed", "failed", "cancelled"],
      default: "created",
    },
    language: {
      type: String,
      enum: ["kn-IN", "hi-IN", "en-IN"],
      default: "kn-IN",
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
    transcriptSegments: [TranscriptSegmentSchema],
    finalTranscript: { type: String },
    summary: { type: String },
    messageDeliveries: [MessageDeliverySchema],
    consentGiven: { type: Boolean, default: false },
    consentTimestamp: { type: Date },
    retentionDays: { type: Number, default: 30 },
    metadata: {
      userAgent: { type: String },
      ipAddress: { type: String },
      district: { type: String },
      state: { type: String },
    },
  },
  { timestamps: true }
);

CallSessionSchema.index({ sessionId: 1 });
CallSessionSchema.index({ userId: 1, startTime: -1 });
CallSessionSchema.index({ status: 1 });

export const CallSession =
  mongoose.models.CallSession || mongoose.model<ICallSession>("CallSession", CallSessionSchema);
