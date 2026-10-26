import { Router, Response } from "express";
import { z } from "zod";
import { FarmerEnquiry, EnquiryStatus } from "../models/FarmerEnquiry";
import { Business } from "../models/Business";
import { BuyerOffer } from "../models/BuyerOffer";
import { authenticate, AuthenticatedRequest, authorizeRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const enquiryRouter = Router();

const createEnquirySchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  offerId: z.string().optional(),
  crop: z.string().min(2, "Crop name is required"),
  variety: z.string().optional(),
  grade: z.string().default("Grade A"),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unit: z.string().default("kg"),
  expectedHarvestDate: z.string().optional(),
  pickupLocation: z.string().min(2, "Pickup location is required"),
  coordinatesConsent: z.boolean().default(false),
  message: z.string().optional(),
  voiceTranscribed: z.boolean().default(false),
});

const statusUpdateSchema = z.object({
  status: z.enum([
    "submitted",
    "viewed",
    "offer_received",
    "negotiating",
    "accepted",
    "rejected",
    "completed",
    "cancelled",
  ]),
  note: z.string().optional(),
});

const respondSchema = z.object({
  proposedPrice: z.number().positive("Proposed price is required"),
  acceptedQuantity: z.number().positive("Accepted quantity is required"),
  pickupArrangements: z.string().min(3, "Pickup arrangements are required"),
  paymentTerms: z.string().min(3, "Payment terms are required"),
  validityDays: z.number().int().positive().default(3),
  writtenNote: z.string().optional(),
});

/**
 * POST /api/v1/enquiries
 * Farmer submits enquiry/offer request to a buyer
 */
enquiryRouter.post(
  "/",
  authenticate,
  authorizeRoles("farmer", "admin"),
  validateBody(createEnquirySchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        businessId,
        offerId,
        crop,
        variety,
        grade,
        quantity,
        unit,
        expectedHarvestDate,
        pickupLocation,
        coordinatesConsent,
        message,
        voiceTranscribed,
      } = req.body;

      const business = await Business.findById(businessId);
      if (!business) {
        res.status(404).json({ success: false, message: "Target business not found" });
        return;
      }

      const enquiry = await FarmerEnquiry.create({
        farmerId: req.user!._id,
        businessId,
        offerId: offerId || undefined,
        crop,
        variety,
        grade,
        quantity,
        unit,
        expectedHarvestDate: expectedHarvestDate ? new Date(expectedHarvestDate) : undefined,
        pickupLocation,
        coordinatesConsent,
        message,
        voiceTranscribed,
        status: "submitted",
        statusHistory: [
          {
            status: "submitted",
            changedBy: req.user!._id,
            note: "Enquiry submitted by farmer",
            timestamp: new Date(),
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: "Enquiry submitted to buyer successfully",
        enquiry,
      });
    } catch (error: any) {
      console.error("❌ Submit enquiry error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to submit enquiry" });
    }
  }
);

/**
 * GET /api/v1/enquiries/mine
 * Farmer views their enquiry history
 */
enquiryRouter.get(
  "/mine",
  authenticate,
  authorizeRoles("farmer", "admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const enquiries = await FarmerEnquiry.find({ farmerId: req.user!._id })
        .populate("businessId", "businessName category phone district state verificationStatus")
        .populate("offerId", "price pricePerKg originalUnit")
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, count: enquiries.length, enquiries });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to fetch enquiries" });
    }
  }
);

/**
 * GET /api/v1/businesses/me/enquiries
 * Buyer views enquiries received for their business
 */
enquiryRouter.get(
  "/business/me",
  authenticate,
  authorizeRoles("buyer", "admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ ownerId: req.user!._id });
      if (!business) {
        res.status(404).json({ success: false, message: "Business not found for this account" });
        return;
      }

      const enquiries = await FarmerEnquiry.find({ businessId: business._id })
        .populate("farmerId", "name phone preferredLanguage")
        .populate("offerId", "price originalUnit")
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, count: enquiries.length, enquiries });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to fetch buyer enquiries" });
    }
  }
);

/**
 * PATCH /api/v1/enquiries/:id/status
 */
enquiryRouter.patch(
  "/:id/status",
  authenticate,
  validateBody(statusUpdateSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const enquiry = await FarmerEnquiry.findById(req.params.id);
      if (!enquiry) {
        res.status(404).json({ success: false, message: "Enquiry not found" });
        return;
      }

      // Authorization check: must be either the farmer or the business owner (or admin)
      const business = await Business.findById(enquiry.businessId);
      const isOwner = business && business.ownerId.toString() === req.user!._id.toString();
      const isFarmer = enquiry.farmerId.toString() === req.user!._id.toString();
      const isAdmin = req.user!.role === "admin";

      if (!isOwner && !isFarmer && !isAdmin) {
        res.status(403).json({ success: false, message: "Forbidden: Not authorized for this enquiry" });
        return;
      }

      const { status, note } = req.body;
      enquiry.status = status;
      enquiry.statusHistory.push({
        status,
        changedBy: req.user!._id,
        note: note || `Status updated to ${status}`,
        timestamp: new Date(),
      });

      await enquiry.save();

      res.status(200).json({ success: true, message: "Enquiry status updated", enquiry });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to update status" });
    }
  }
);

/**
 * POST /api/v1/enquiries/:id/respond
 * Buyer responds to a farmer's enquiry with formal terms
 */
enquiryRouter.post(
  "/:id/respond",
  authenticate,
  authorizeRoles("buyer", "admin"),
  validateBody(respondSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const enquiry = await FarmerEnquiry.findById(req.params.id);
      if (!enquiry) {
        res.status(404).json({ success: false, message: "Enquiry not found" });
        return;
      }

      const business = await Business.findById(enquiry.businessId);
      if (!business || (business.ownerId.toString() !== req.user!._id.toString() && req.user!.role !== "admin")) {
        res.status(403).json({ success: false, message: "Forbidden: You do not own this business listing" });
        return;
      }

      const { proposedPrice, acceptedQuantity, pickupArrangements, paymentTerms, validityDays, writtenNote } =
        req.body;

      const offerValidityDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

      enquiry.buyerResponse = {
        proposedPrice,
        acceptedQuantity,
        pickupArrangements,
        paymentTerms,
        offerValidityDate,
        writtenNote,
        respondedAt: new Date(),
      };

      enquiry.status = "offer_received";
      enquiry.statusHistory.push({
        status: "offer_received",
        changedBy: req.user!._id,
        note: `Buyer sent purchase offer: ₹${proposedPrice}/kg for ${acceptedQuantity}kg`,
        timestamp: new Date(),
      });

      await enquiry.save();

      res.status(200).json({
        success: true,
        message: "Purchase response submitted to farmer",
        enquiry,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to submit response" });
    }
  }
);
