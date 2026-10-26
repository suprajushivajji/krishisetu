import { Router, Request, Response } from "express";
import { z } from "zod";
import { BuyerOffer } from "../models/BuyerOffer";
import { Business } from "../models/Business";
import { authenticate, AuthenticatedRequest, authorizeRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { normalizePriceToPerKg } from "../utils/calculator";

export const offerRouter = Router();

const offerSchema = z.object({
  crop: z.string().min(2, "Crop name is required"),
  variety: z.string().optional(),
  grade: z.string().default("Grade A"),
  price: z.number().positive("Price must be greater than zero"),
  currency: z.string().default("INR"),
  originalUnit: z.string().default("kg"),
  minQuantity: z.number().positive().default(50),
  maxQuantity: z.number().positive().default(5000),
  quantityUnit: z.string().default("kg"),
  pickupConditions: z.enum(["pickup_available", "dropoff_required", "negotiable"]).default("pickup_available"),
  purchaseLocation: z.string().min(2, "Purchase location is required"),
  expiryDays: z.number().int().positive().default(14),
  paymentTerms: z.string().default("Immediate on pickup"),
});

/**
 * POST /api/v1/offers
 * Buyer publishes a new buying offer
 */
offerRouter.post(
  "/",
  authenticate,
  authorizeRoles("buyer", "admin"),
  validateBody(offerSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ ownerId: req.user!._id });
      if (!business) {
        res.status(403).json({
          success: false,
          message: "You must register a business profile before publishing buyer offers",
        });
        return;
      }

      const { expiryDays, price, originalUnit, ...data } = req.body;
      const pricePerKg = normalizePriceToPerKg(price, originalUnit);
      const expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

      const offer = await BuyerOffer.create({
        ...data,
        businessId: business._id,
        price,
        originalUnit,
        pricePerKg,
        expiryDate,
        status: "active",
        lastPriceConfirmedAt: new Date(),
      });

      res.status(201).json({ success: true, message: "Buying offer published", offer });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to publish offer" });
    }
  }
);

/**
 * GET /api/v1/offers
 * List offers (with filters for crop, status, business)
 */
offerRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { crop, businessId, status = "active" } = req.query;
    const filter: any = {};

    if (crop) filter.crop = { $regex: new RegExp(String(crop), "i") };
    if (businessId) filter.businessId = businessId;

    if (status === "active") {
      filter.status = "active";
      filter.expiryDate = { $gt: new Date() };
    } else if (status !== "all") {
      filter.status = status;
    }

    const offers = await BuyerOffer.find(filter)
      .populate("businessId", "businessName category phone district state verificationStatus")
      .sort({ updatedAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, count: offers.length, offers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch offers" });
  }
});

/**
 * GET /api/v1/offers/:id
 */
offerRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const offer = await BuyerOffer.findById(req.params.id).populate(
      "businessId",
      "businessName category phone address district state verificationStatus"
    );
    if (!offer) {
      res.status(404).json({ success: false, message: "Offer not found" });
      return;
    }

    res.status(200).json({ success: true, offer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch offer" });
  }
});

/**
 * PATCH /api/v1/offers/:id
 * Only the owning buyer can update the offer
 */
offerRouter.patch(
  "/:id",
  authenticate,
  authorizeRoles("buyer", "admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const offer = await BuyerOffer.findById(req.params.id);
      if (!offer) {
        res.status(404).json({ success: false, message: "Offer not found" });
        return;
      }

      // Check ownership
      const business = await Business.findOne({ _id: offer.businessId, ownerId: req.user!._id });
      if (!business && req.user!.role !== "admin") {
        res.status(403).json({ success: false, message: "Forbidden: You do not own this offer" });
        return;
      }

      const { price, originalUnit, status, minQuantity, maxQuantity, expiryDate } = req.body;
      const updateData: any = {};

      if (price !== undefined) {
        updateData.price = price;
        updateData.pricePerKg = normalizePriceToPerKg(
          price,
          originalUnit || offer.originalUnit
        );
        updateData.lastPriceConfirmedAt = new Date();
      }
      if (originalUnit) updateData.originalUnit = originalUnit;
      if (status) updateData.status = status;
      if (minQuantity) updateData.minQuantity = minQuantity;
      if (maxQuantity) updateData.maxQuantity = maxQuantity;
      if (expiryDate) updateData.expiryDate = new Date(expiryDate);

      const updated = await BuyerOffer.findByIdAndUpdate(offer._id, { $set: updateData }, { new: true });

      res.status(200).json({ success: true, message: "Offer updated", offer: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to update offer" });
    }
  }
);
