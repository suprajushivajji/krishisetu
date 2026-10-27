import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { config } from "./config";
import { connectDB } from "./db";
import { authRouter } from "./routes/auth";
import { farmerRouter } from "./routes/farmers";
import { businessRouter } from "./routes/businesses";
import { offerRouter } from "./routes/offers";
import { priceRouter } from "./routes/prices";
import { marketRouter } from "./routes/markets";
import { predictionRouter } from "./routes/predictions";
import { enquiryRouter } from "./routes/enquiries";
import { voiceRouter } from "./routes/voice";
import { adminRouter } from "./routes/admin";
import { MandiPriceService } from "./services/mandi";

export const app = express();

// Security, CORS & Middlewares
const allowedOrigins = [
  config.CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://krishisetu.vercel.app", // Production Vercel frontend
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// REST APIs under /api/v1
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/farmers", farmerRouter);
app.use("/api/v1/businesses", businessRouter);
app.use("/api/v1/buyers", businessRouter); // aliased for /api/v1/buyers/nearby
app.use("/api/v1/offers", offerRouter);
app.use("/api/v1/prices", priceRouter);
app.use("/api/v1/markets", marketRouter);
app.use("/api/v1/predictions", predictionRouter);
app.use("/api/v1", priceRouter); // for /api/v1/fair-price/...
app.use("/api/v1/enquiries", enquiryRouter);
app.use("/api/v1/voice", voiceRouter);
app.use("/api/v1/admin", adminRouter);

// Base Health Check (public, no auth required)
app.get("/api/v1/health", async (_req: Request, res: Response) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;
    const dbName = dbConnected ? mongoose.connection.name : "not connected";
    
    res.status(200).json({
      status: "ok",
      service: "KrishiSetu Express API",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        name: dbName,
        state: mongoose.connection.readyState === 1 ? "connected" : 
                mongoose.connection.readyState === 2 ? "connecting" : "disconnected"
      },
      environment: process.env.NODE_ENV || "development"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      timestamp: new Date().toISOString()
    });
  }
});

// Public Integration Status Endpoint (no auth required)
app.get("/api/v1/integrations/status", async (_req: Request, res: Response) => {
  try {
    const { config } = await import("./config");
    const { sourceManager } = await import("./services/marketSources");
    
    const dbConnected = mongoose.connection.readyState === 1;
    
    const integrations = [
      {
        name: "MongoDB",
        configured: Boolean(config.MONGODB_URI && config.MONGODB_URI !== "mongodb://127.0.0.1:27017/krishisetu"),
        healthy: dbConnected,
        message: dbConnected ? "Connected" : "Disconnected"
      },
      {
        name: "data.gov.in",
        configured: Boolean(config.DATA_GOV_IN_API_KEY),
        healthy: false, // Would require actual health check
        message: config.DATA_GOV_IN_API_KEY ? "Configured" : "Not configured"
      },
      {
        name: "Gnani STT/TTS",
        configured: Boolean(config.GNANI_API_KEY),
        healthy: false, // Would require actual health check
        message: config.GNANI_API_KEY ? "Configured" : "Not configured"
      },
      {
        name: "MapTiler",
        configured: Boolean(config.MAPTILER_API_KEY),
        healthy: true, // Client-side only
        message: config.MAPTILER_API_KEY ? "Configured" : "Using OSM fallback"
      },
      {
        name: "Google Places",
        configured: Boolean(config.GOOGLE_MAPS_API_KEY),
        healthy: false,
        message: config.GOOGLE_MAPS_API_KEY ? "Configured" : "Not configured"
      },
      {
        name: "OpenRouter AI",
        configured: Boolean(config.OPENROUTER_API_KEY),
        healthy: false,
        message: config.OPENROUTER_API_KEY ? "Configured" : "Not configured"
      }
    ];
    
    res.status(200).json({
      success: true,
      integrations,
      summary: {
        total: integrations.length,
        configured: integrations.filter(i => i.configured).length,
        healthy: integrations.filter(i => i.healthy).length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch integration status"
    });
  }
});

// Centralized 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
});

// Centralized Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("🔥 [Server Error]:", err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "An unexpected internal server error occurred",
  });
});

export async function startServer() {
  try {
    await connectDB();
    await MandiPriceService.removeDemonstrationRecords().catch(() => {});

    // Use Render's PORT or fall back to config.PORT
    const port = process.env.PORT || config.PORT;
    
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 [KrishiSetu Server] Listening on port ${port}`);
      console.log(`📡 [API Base] http://localhost:${port}/api/v1`);
      console.log(`🌐 [Client URL] ${config.CLIENT_URL}`);
      console.log(`🏠 [Environment] ${config.NODE_ENV}`);
      console.log(`✅ [Server Ready] HTTP server is accepting connections`);
    });

    // Initial data sync (non-blocking, with timeout and error handling)
    // This runs in the background and doesn't block server readiness
    setTimeout(() => {
      const syncPromise = MandiPriceService.syncLocalMarketPrices();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Mandi sync timeout after 30s")), 30000)
      );
      
      Promise.race([syncPromise, timeoutPromise])
        .then((syncResult: any) => {
          console.log(`📈 [Mandi Sync] ${syncResult.status}: ${syncResult.recordsFetched} live records fetched.`);
          if (syncResult.message) console.warn(`⚠️ [Mandi Sync] ${syncResult.message}`);
        })
        .catch((err) => {
          console.warn(`⚠️ [Mandi Sync] Failed to sync initial data:`, err.message);
          console.log(`ℹ️  [Mandi Sync] Server is running, but initial data sync failed. Sync will retry on next scheduled job.`);
        });
    }, 2000); // Delay sync by 2s to let server start cleanly

    return server;
  } catch (error) {
    console.error("❌ [Server Startup] Failed to start server:", error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test" && require.main === module) {
  startServer();
}
