import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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
app.use(
  cors({
    origin: [config.CLIENT_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
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

// Base Health Check
app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "KrishiSetu Express API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
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
  await connectDB();
  await MandiPriceService.removeDemonstrationRecords().catch(() => {});

  const server = app.listen(config.PORT, () => {
    console.log(`🚀 [KrishiSetu Server] Listening at http://localhost:${config.PORT}`);
    console.log(`📡 [API Base] http://localhost:${config.PORT}/api/v1`);
  });

  void MandiPriceService.syncLocalMarketPrices().then((syncResult) => {
    console.log(`📈 [Mandi Sync] ${syncResult.status}: ${syncResult.recordsFetched} live records fetched.`);
    if (syncResult.message) console.warn(`⚠️ [Mandi Sync] ${syncResult.message}`);
  });

  return server;
}

if (process.env.NODE_ENV !== "test" && require.main === module) {
  startServer();
}
