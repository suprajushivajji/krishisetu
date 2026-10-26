import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/krishisetu"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters long"),
  GNANI_API_KEY: z.string().optional().default(""),
  MAPTILER_API_KEY: z.string().optional().default(""),
  DATA_GOV_IN_API_KEY: z.string().optional().default(""),
  AGMARKNET_RESOURCE_ID: z.string().optional().default("9ef84268-d588-465a-a308-a864a43d0070"),
  GOOGLE_MAPS_API_KEY: z.string().optional().default(""),
  OPENROUTER_API_KEY: z.string().optional().default(""),
  OPENROUTER_MODEL: z.string().optional().default("anthropic/claude-3-haiku"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingKeys = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  console.warn("⚠️ [Config Warning] Environment validation issues:\n" + missingKeys);
  
  if (process.env.NODE_ENV === "production") {
    const criticalErrors = parsed.error.issues.filter(
      (i) => i.path.includes("JWT_SECRET") || i.path.includes("MONGODB_URI")
    );
    if (criticalErrors.length > 0) {
      console.error("❌ [Config Error] Critical environment variables missing in production:");
      criticalErrors.forEach((i) => console.error(`  - ${i.path.join(".")}: ${i.message}`));
      process.exit(1);
    }
  }
}

export const config = parsed.success
  ? parsed.data
  : {
      NODE_ENV: (process.env.NODE_ENV as "development" | "test" | "production") || "development",
      PORT: Number(process.env.PORT) || 4000,
      CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
      MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/krishisetu",
      JWT_SECRET: process.env.JWT_SECRET || "krishisetu_fallback_secret_key_12345",
      GNANI_API_KEY: process.env.GNANI_API_KEY || "",
      MAPTILER_API_KEY: process.env.MAPTILER_API_KEY || "",
      DATA_GOV_IN_API_KEY: process.env.DATA_GOV_IN_API_KEY || "",
      AGMARKNET_RESOURCE_ID: process.env.AGMARKNET_RESOURCE_ID || "9ef84268-d588-465a-a308-a864a43d0070",
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
      OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "anthropic/claude-3-haiku",
    };
