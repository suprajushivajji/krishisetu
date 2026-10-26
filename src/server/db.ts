import mongoose from "mongoose";
import { config } from "./config";

let isConnecting = false;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState >= 1) {
    return mongoose;
  }

  if (isConnecting) {
    throw new Error("MongoDB connection already in progress");
  }

  try {
    isConnecting = true;
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    console.log(`✅ [MongoDB] Connected to database: ${conn.connection.name}`);
    isConnecting = false;
    return conn;
  } catch (error) {
    isConnecting = false;
    const errorMessage = (error as Error).message;
    console.error("❌ [MongoDB] Connection error:", errorMessage);
    
    if (process.env.NODE_ENV === "production") {
      console.error("❌ [MongoDB] Failed to connect in production. Check MONGODB_URI environment variable and MongoDB Atlas network access.");
      process.exit(1);
    }
    
    throw new Error(`MongoDB connection failed: ${errorMessage}`);
  }
}

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ [MongoDB] Disconnected from server.");
});

mongoose.connection.on("error", (error) => {
  console.error("❌ [MongoDB] Connection error:", error);
});
