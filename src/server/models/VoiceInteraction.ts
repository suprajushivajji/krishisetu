import mongoose, { Schema, Document, Types } from "mongoose";

export interface IVoiceInteraction extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  language: string;
  transcript: string;
  detectedIntent?: string;
  extractedEntities?: Record<string, any>;
  responseText?: string;
  hasAudioResponse: boolean;
  userConsented: boolean;
  createdAt: Date;
}

const VoiceInteractionSchema = new Schema<IVoiceInteraction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    language: { type: String, required: true, default: "kn" },
    transcript: { type: String, required: true },
    detectedIntent: { type: String },
    extractedEntities: { type: Schema.Types.Mixed },
    responseText: { type: String },
    hasAudioResponse: { type: Boolean, default: false },
    userConsented: { type: Boolean, default: true },
  },
  { timestamps: true }
);

VoiceInteractionSchema.index({ userId: 1, createdAt: -1 });

export const VoiceInteraction =
  mongoose.models.VoiceInteraction ||
  mongoose.model<IVoiceInteraction>("VoiceInteraction", VoiceInteractionSchema);
