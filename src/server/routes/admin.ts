/**
 * Admin API Routes
 * POST /api/v1/admin/sources/sync - sync data sources
 * POST /api/v1/admin/markets/import - import market directory data
 * POST /api/v1/admin/prices/import-csv - import price CSV
 * GET /api/v1/admin/health - source health dashboard
 */

import { Router, Request, Response } from "express";
import { authenticate, AuthenticatedRequest, authorizeRoles } from "../middleware/auth";
import { sourceManager } from "../services/marketSources";
import { MarketPrice } from "../models/MarketPrice";
import { MandiPriceService } from "../services/mandi";

export const adminRouter = Router();

/**
 * GET /api/v1/admin/health
 * Source health dashboard
 */
adminRouter.get("/health", authenticate, authorizeRoles("admin"), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const health = await sourceManager.getHealth();

    res.status(200).json({
      success: true,
      sources: health,
      summary: {
        total: health.length,
        configured: health.filter((h) => h.isConfigured).length,
        healthy: health.filter((h) => h.status === "healthy").length,
        stale: health.filter((h) => h.status === "stale").length,
        error: health.filter((h) => h.status === "error").length,
        unconfigured: health.filter((h) => h.status === "unconfigured").length,
      },
    });
  } catch (error: any) {
    console.error("❌ Admin health error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch health status" });
  }
});

/**
 * POST /api/v1/admin/sources/sync
 * Sync a specific source or all configured sources
 */
adminRouter.post(
  "/sources/sync",
  authenticate,
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { sourceType, options } = req.body;

      let results;

      if (sourceType) {
        // Sync specific source
        const result = await sourceManager.syncSource(sourceType, options);
        results = [result];
      } else {
        // Sync all configured sources
        results = await sourceManager.syncAllConfigured();
      }

      res.status(200).json({
        success: true,
        results,
        summary: {
          total: results.length,
          successful: results.filter((r) => r.status === "success").length,
          failed: results.filter((r) => r.status === "failed").length,
          unconfigured: results.filter((r) => r.status === "unconfigured").length,
          totalRecordsInserted: results.reduce((sum, r) => sum + r.recordsInserted, 0),
          totalRecordsUpdated: results.reduce((sum, r) => sum + r.recordsUpdated, 0),
        },
      });
    } catch (error: any) {
      console.error("❌ Admin sync error:", error);
      res.status(500).json({ success: false, message: error.message || "Sync failed" });
    }
  }
);

/**
 * POST /api/v1/admin/prices/import-csv
 * Import price data from CSV (legacy endpoint, now uses adapter)
 */
adminRouter.post(
  "/prices/import-csv",
  authenticate,
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await MandiPriceService.syncLocalMarketPrices();

      res.status(200).json({
        success: true,
        result,
      });
    } catch (error: any) {
      console.error("❌ Admin CSV import error:", error);
      res.status(500).json({ success: false, message: error.message || "CSV import failed" });
    }
  }
);

/**
 * POST /api/v1/admin/markets/import
 * Import APMC directory data from CSV
 */
adminRouter.post(
  "/markets/import",
  authenticate,
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { csvPath, overwrite } = req.body;

      const { ApmcDirectoryAdapter } = await import("../services/marketSources/apmcDirectoryAdapter");
      const adapter = new ApmcDirectoryAdapter();

      const result = await adapter.sync({ csvPath, overwrite });

      res.status(200).json({
        success: true,
        result,
      });
    } catch (error: any) {
      console.error("❌ Admin market import error:", error);
      res.status(500).json({ success: false, message: error.message || "Market import failed" });
    }
  }
);

/**
 * DELETE /api/v1/admin/prices/clear
 * Clear all price data (use with caution)
 */
adminRouter.delete(
  "/prices/clear",
  authenticate,
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { source } = req.query;

      const filter: any = {};
      if (source) filter.source = source;

      const result = await MarketPrice.deleteMany(filter);

      res.status(200).json({
        success: true,
        deletedCount: result.deletedCount,
        message: `Deleted ${result.deletedCount} price records`,
      });
    } catch (error: any) {
      console.error("❌ Admin clear error:", error);
      res.status(500).json({ success: false, message: error.message || "Clear failed" });
    }
  }
);
