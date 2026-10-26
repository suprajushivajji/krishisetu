import mongoose from "mongoose";
import { config } from "./config";

let isConnecting = false;

export async function connectDB(): Promise<typeof mongoose | null> {
  if (mongoose.connection.readyState >= 1) {
    return mongoose;
  }

  if (isConnecting) {
    return null;
  }

  try {
    isConnecting = true;
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ [MongoDB] Connected to database: ${conn.connection.name}`);
    isConnecting = false;
    return conn;
  } catch (error) {
    isConnecting = false;
    console.error("❌ [MongoDB] Connection error:", (error as Error).message);
    return null;
  }
}

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ [MongoDB] Disconnected from server.");
});
