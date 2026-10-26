import mongoose, { Schema, Document, Types } from "mongoose";

export type UserRole = "farmer" | "buyer" | "admin";

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
  preferredLanguage: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["farmer", "buyer", "admin"], default: "farmer" },
    isVerified: { type: Boolean, default: false },
    preferredLanguage: { type: String, default: "kn" }, // 'kn' (Kannada), 'en' (English), 'hi' (Hindi), 'te' (Telugu)
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
