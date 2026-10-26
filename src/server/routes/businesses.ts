import { Router, Request, Response } from "express";
import { z } from "zod";
import { Business } from "../models/Business";
import { BuyerOffer } from "../models/BuyerOffer";
import { MarketPrice } from "../models/MarketPrice";
import { authenticate, AuthenticatedRequest, authorizeRoles } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { calculateHaversineDistanceKm } from "../utils/calculator";

export const businessRouter = Router();

const knownDistrictCoordinates: Record<string, [number, number]> = {
  chamarajanagar: [11.9261, 76.9437],
  davanagere: [14.4644, 75.9218],
  dharwad: [15.4589, 75.0078],
  haveri: [14.7951, 75.3991],
  gadag: [15.4297, 75.6297],
  belagavi: [15.8497, 74.4977],
  shivamogga: [13.9299, 75.5681],
  mandya: [12.5218, 76.8951],
  mysuru: [12.2958, 76.6394],
  bengaluru: [12.9716, 77.5946],
};

const businessCreateSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  category: z.enum([
    "local_vendor",
    "wholesaler",
    "retailer",
    "distributor",
    "processor",
    "exporter",
    "cooperative",
    "fpo",
    "bulk_purchaser",
  ]),
  contactPerson: z.string().min(2, "Contact person name is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "10-digit valid Indian phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(5, "Physical address is required"),
  locality: z.string().optional(),
  taluk: z.string().optional(),
  district: z.string().min(2, "District is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  cropsPurchased: z.array(z.string()).min(1, "At least one crop must be selected"),
  cropVarieties: z.array(z.string()).optional(),
  acceptableGrades: z.array(z.string()).optional(),
  minQuantityKg: z.number().positive().optional().default(50),
  maxQuantityKg: z.number().positive().optional().default(10000),
  preferredUnit: z.string().optional().default("kg"),
  procurementFrequency: z.string().optional().default("daily"),
  transportPreference: z.enum(["pickup", "delivery", "both"]).default("pickup"),
  serviceCoverage: z
    .enum(["village", "taluk", "district", "multiple_districts", "statewide"])
    .default("district"),
  serviceDistricts: z.array(z.string()).optional(),
  paymentMethods: z.array(z.string()).optional(),
  paymentTerms: z.string().optional().default("Immediate on pickup/delivery"),
  description: z.string().optional(),
  consentToPublish: z.boolean().default(true),
  isDraft: z.boolean().default(false),
});

const businessUpdateSchema = businessCreateSchema.partial();

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(500).default(50),
  district: z.string().optional(),
  state: z.string().optional().default("Karnataka"),
  crop: z.string().optional(),
  category: z.string().optional(),
  verifiedOnly: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["distance", "price", "updated"]).default("distance"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * POST /api/v1/businesses
 * Register a business profile (Buyer role required)
 */
businessRouter.post(
  "/",
  authenticate,
  authorizeRoles("buyer", "admin"),
  validateBody(businessCreateSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { latitude, longitude, ...data } = req.body;

      const business = await Business.create({
        ...data,
        ownerId: req.user!._id,
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        serviceDistricts: data.serviceDistricts?.length
          ? data.serviceDistricts
          : [data.district],
        verificationStatus: "pending", // Genuine verification states: pending, verified, rejected, suspended
        isActive: !data.isDraft,
      });

      res.status(201).json({
        success: true,
        message: data.isDraft
          ? "Business draft saved successfully."
          : "Business registered successfully and submitted for verification.",
        business,
      });
    } catch (error: any) {
      console.error("❌ Business registration error:", error);
      res.status(500).json({ success: false, message: error.message || "Registration failed" });
    }
  }
);

/**
 * GET /api/v1/businesses/me
 */
businessRouter.get(
  "/me",
  authenticate,
  authorizeRoles("buyer", "admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ ownerId: req.user!._id });
      if (!business) {
        res.status(404).json({ success: false, message: "No business profile found for this account" });
        return;
      }

      // Also get active offers count
      const activeOffersCount = await BuyerOffer.countDocuments({
        businessId: business._id,
        status: "active",
      });

      res.status(200).json({ success: true, business, activeOffersCount });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to fetch business" });
    }
  }
);

/**
 * PATCH /api/v1/businesses/me
 */
businessRouter.patch(
  "/me",
  authenticate,
  authorizeRoles("buyer", "admin"),
  validateBody(businessUpdateSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const business = await Business.findOne({ ownerId: req.user!._id });
      if (!business) {
        res.status(404).json({ success: false, message: "No business profile found" });
        return;
      }

      const { latitude, longitude, ...rest } = req.body;
      const updateData: any = { ...rest };

      if (latitude !== undefined && longitude !== undefined) {
        updateData.location = {
          type: "Point",
          coordinates: [longitude, latitude],
        };
      }

      // Prevent mass-assignment of privileged fields
      delete updateData.ownerId;
      delete updateData.verificationStatus;

      const updated = await Business.findByIdAndUpdate(business._id, { $set: updateData }, { new: true });

      res.status(200).json({ success: true, message: "Business profile updated", business: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Update failed" });
    }
  }
);

/**
 * GET /api/v1/buyers/nearby
 * Genuine 2dsphere location search or district fallback
 */
businessRouter.get(
  "/nearby",
  validateQuery(nearbyQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        lat,
        lng,
        radiusKm,
        district,
        state,
        crop,
        category,
        verifiedOnly,
        page,
        limit,
      } = res.locals.validatedQuery as any;

      const hasCoordinates = lat !== undefined && lng !== undefined;
      const queryConditions: any = {
        isActive: true,
        consentToPublish: true,
      };

      if (crop) {
        queryConditions.cropsPurchased = { $regex: new RegExp(crop, "i") };
      }

      if (category) {
        queryConditions.category = category;
      }

      if (verifiedOnly === "true") {
        queryConditions.verificationStatus = "verified";
      }

      let businessesWithDistance: any[] = [];

      // 1. If coordinates are provided, perform genuine 2dsphere geoNear aggregation
      if (hasCoordinates) {
        const radiusMeters = radiusKm * 1000;
        businessesWithDistance = await Business.aggregate([
          {
            $geoNear: {
              near: { type: "Point", coordinates: [Number(lng), Number(lat)] },
              distanceField: "distanceMeters",
              maxDistance: radiusMeters,
              spherical: true,
              query: queryConditions,
            },
          },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ]);
      } else {
        // 2. Fallback to manual District / State selection
        if (district) {
          queryConditions.$or = [
            { district: { $regex: new RegExp(district, "i") } },
            { serviceDistricts: { $regex: new RegExp(district, "i") } },
            { serviceCoverage: "statewide" },
          ];
        } else if (state) {
          queryConditions.state = { $regex: new RegExp(state, "i") };
        }

        const list = await Business.find(queryConditions)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

        businessesWithDistance = list.map((b) => ({
          ...b,
          distanceMeters: null,
        }));
      }

      // Populate active offers for each business and compute distanceKm
      const businessIds = businessesWithDistance.map((b) => b._id);
      const now = new Date();
      const activeOffers = await BuyerOffer.find({
        businessId: { $in: businessIds },
        status: "active",
        expiryDate: { $gt: now }, // exclude expired offers
      }).lean();

      const offersByBusiness: Record<string, any[]> = {};
      for (const offer of activeOffers) {
        const bId = offer.businessId.toString();
        if (!offersByBusiness[bId]) offersByBusiness[bId] = [];
        offersByBusiness[bId].push(offer);
      }

      const results = businessesWithDistance.map((b) => {
        const distKm =
          b.distanceMeters !== null && b.distanceMeters !== undefined
            ? Number((b.distanceMeters / 1000).toFixed(1))
            : hasCoordinates && b.location?.coordinates
            ? calculateHaversineDistanceKm(
                lat,
                lng,
                b.location.coordinates[1],
                b.location.coordinates[0]
              )
            : null;

        const bOffers = offersByBusiness[b._id.toString()] || [];

        return {
          id: b._id,
          name: b.businessName,
          category: b.category,
          contactPerson: b.contactPerson,
          phone: b.phone,
          address: b.address,
          locality: b.locality,
          taluk: b.taluk,
          district: b.district,
          state: b.state,
          coordinates: b.location?.coordinates,
          cropsPurchased: b.cropsPurchased,
          transportPreference: b.transportPreference,
          serviceCoverage: b.serviceCoverage,
          paymentMethods: b.paymentMethods,
          paymentTerms: b.paymentTerms,
          verificationStatus: b.verificationStatus,
          isVerified: b.verificationStatus === "verified",
          distanceKm: distKm,
          distanceLabel: distKm !== null ? `${distKm} km (approx.)` : "Service area match",
          activeOffers: bOffers,
          bestOfferPricePerKg:
            bOffers.length > 0
              ? Math.max(...bOffers.map((o) => o.pricePerKg))
              : null,
          isMarketReference: false,
        };
      });

      if (results.length === 0 && crop) {
        const marketFilter: any = {
          commodity: { $regex: new RegExp(String(crop), "i") },
        };
        if (district) {
          marketFilter.district = { $regex: new RegExp(String(district), "i") };
        }
        const localMarketRows = await MarketPrice.find(marketFilter)
          .sort({ arrivalDate: -1, modalPricePerKg: -1 })
          .limit(50)
          .lean();
        const marketRows = localMarketRows.length > 0
          ? localMarketRows
          : await MarketPrice.find({ commodity: { $regex: new RegExp(String(crop), "i") } })
              .sort({ arrivalDate: -1, modalPricePerKg: -1 })
              .limit(50)
              .lean();

        const marketResults = marketRows.map((market) => {
          const center = knownDistrictCoordinates[String(market.district).toLowerCase().trim()];
          const distanceKm = hasCoordinates && center
            ? calculateHaversineDistanceKm(lat, lng, center[0], center[1])
            : null;
          return {
            id: `market-${market._id}`,
            name: market.market,
            category: "Mandi benchmark",
            contactPerson: "",
            phone: "",
            address: `${market.district}, ${market.state}`,
            locality: market.district,
            taluk: "",
            district: market.district,
            state: market.state,
            coordinates: center ? [center[1], center[0]] : undefined,
            cropsPurchased: [market.commodity],
            transportPreference: "confirm at market",
            serviceCoverage: "district",
            paymentMethods: [],
            paymentTerms: "Confirm directly with market",
            verificationStatus: "source_record",
            isVerified: false,
            isMarketReference: true,
            distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(1)),
            distanceLabel: distanceKm === null ? `${market.district} market` : `${distanceKm.toFixed(1)} km approx.`,
            activeOffers: [],
            bestOfferPricePerKg: market.modalPricePerKg,
            marketPricePerKg: market.modalPricePerKg,
            source: market.source,
            reportedDate: market.arrivalDate,
          };
        });

        results.push(...marketResults.sort((first, second) =>
          (first.distanceKm ?? Number.POSITIVE_INFINITY) - (second.distanceKm ?? Number.POSITIVE_INFINITY)
        ));
      }

      res.status(200).json({
        success: true,
        count: results.length,
        searchMode: hasCoordinates ? "gps_radius" : "manual_district",
        radiusKm: hasCoordinates ? radiusKm : null,
        results,
      });
    } catch (error: any) {
      console.error("❌ Nearby search error:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to search buyers" });
    }
  }
);

/**
 * GET /api/v1/businesses/:id
 */
businessRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      res.status(404).json({ success: false, message: "Business not found" });
      return;
    }

    const offers = await BuyerOffer.find({
      businessId: business._id,
      status: "active",
      expiryDate: { $gt: new Date() },
    });

    res.status(200).json({
      success: true,
      business,
      offers,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch business" });
  }
});
