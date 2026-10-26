import { Router, Response } from "express";
import { z } from "zod";
import { FarmerProfile } from "../models/FarmerProfile";
import { authenticate, AuthenticatedRequest, authorizeRoles } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const farmerRouter = Router();

const updateProfileSchema = z.object({
  farmName: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  taluk: z.string().optional(),
  village: z.string().optional(),
  primaryCrops: z.array(z.string()).optional(),
  totalAcreage: z.number().optional(),
  voiceConsent: z.boolean().optional(),
});

const updateLocationSchema = z.object({
  state: z.string().min(2),
  district: z.string().min(2),
  taluk: z.string().optional(),
  village: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationConsent: z.boolean().default(true),
});

/**
 * GET /api/v1/farmers/me
 */
farmerRouter.get(
  "/me",
  authenticate,
  authorizeRoles("farmer", "admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      let profile = await FarmerProfile.findOne({ userId: req.user!._id });
      if (!profile) {
        profile = await FarmerProfile.create({
          userId: req.user!._id,
          state: "Karnataka",
          district: "Davanagere",
          taluk: "Davanagere",
          primaryCrops: ["Tomato"],
          locationConsent: false,
        });
      }

      res.status(200).json({ success: true, profile });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to fetch profile" });
    }
  }
);

/**
 * PATCH /api/v1/farmers/me
 */
farmerRouter.patch(
  "/me",
  authenticate,
  authorizeRoles("farmer", "admin"),
  validateBody(updateProfileSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const profile = await FarmerProfile.findOneAndUpdate(
        { userId: req.user!._id },
        { $set: req.body },
        { new: true, upsert: true }
      );

      res.status(200).json({ success: true, message: "Profile updated", profile });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to update profile" });
    }
  }
);

/**
 * PATCH /api/v1/farmers/me/location
 */
farmerRouter.patch(
  "/me/location",
  authenticate,
  authorizeRoles("farmer", "admin"),
  validateBody(updateLocationSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { state, district, taluk, village, latitude, longitude, locationConsent } = req.body;

      const updateData: any = {
        state,
        district,
        taluk: taluk || "",
        village: village || "",
        locationConsent,
      };

      if (locationConsent && latitude !== undefined && longitude !== undefined) {
        updateData.coordinates = {
          type: "Point",
          coordinates: [longitude, latitude],
        };
      }

      const profile = await FarmerProfile.findOneAndUpdate(
        { userId: req.user!._id },
        { $set: updateData },
        { new: true, upsert: true }
      );

      res.status(200).json({
        success: true,
        message: "Active location updated successfully",
        profile: {
          state: profile.state,
          district: profile.district,
          taluk: profile.taluk,
          locationConsent: profile.locationConsent,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to update location" });
    }
  }
);
