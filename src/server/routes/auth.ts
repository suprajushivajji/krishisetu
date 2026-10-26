import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, IUser } from "../models/User";
import { FarmerProfile } from "../models/FarmerProfile";
import { Business } from "../models/Business";
import { authenticate, AuthenticatedRequest, generateToken } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please provide a valid 10-digit Indian phone number"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["farmer", "buyer", "admin"]).default("farmer"),
  preferredLanguage: z.string().default("kn"),
  // Optional farmer-specific registration fields
  state: z.string().optional().default("Karnataka"),
  district: z.string().optional().default("Davanagere"),
  taluk: z.string().optional(),
});

const loginSchema = z.object({
  phone: z.string().min(10, "Phone number required"),
  password: z.string().min(1, "Password is required"),
});

/**
 * POST /api/v1/auth/register
 */
authRouter.post(
  "/register",
  validateBody(registerSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, phone, email, password, role, preferredLanguage, state, district, taluk } =
        req.body;

      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: "A user with this phone number is already registered. Please log in.",
        });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        name,
        phone,
        email: email || undefined,
        passwordHash,
        role,
        isVerified: false,
        preferredLanguage,
      });

      // Automatically create a base profile for the role
      if (role === "farmer") {
        await FarmerProfile.create({
          userId: user._id,
          state: state || "Karnataka",
          district: district || "Davanagere",
          taluk: taluk || "",
          locationConsent: false,
          primaryCrops: ["Tomato"],
        });
      }

      const token = generateToken({
        userId: user._id.toString(),
        role: user.role,
        phone: user.phone,
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        success: true,
        message: "Registration successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          preferredLanguage: user.preferredLanguage,
        },
      });
    } catch (error: any) {
      console.error("❌ Register error:", error);
      res.status(500).json({ success: false, message: error.message || "Registration failed" });
    }
  }
);

/**
 * POST /api/v1/auth/login
 */
authRouter.post(
  "/login",
  validateBody(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { phone, password } = req.body;

      const user = await User.findOne({ phone });
      if (!user) {
        res.status(401).json({ success: false, message: "Invalid phone number or password" });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ success: false, message: "Invalid phone number or password" });
        return;
      }

      const token = generateToken({
        userId: user._id.toString(),
        role: user.role,
        phone: user.phone,
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          preferredLanguage: user.preferredLanguage,
        },
      });
    } catch (error: any) {
      console.error("❌ Login error:", error);
      res.status(500).json({ success: false, message: error.message || "Login failed" });
    }
  }
);

/**
 * POST /api/v1/auth/logout
 */
authRouter.post("/logout", (req: Request, res: Response): void => {
  res.clearCookie("token");
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

/**
 * GET /api/v1/auth/me
 */
authRouter.get("/me", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    let profile: any = null;
    let business: any = null;

    if (user.role === "farmer") {
      profile = await FarmerProfile.findOne({ userId: user._id });
    } else if (user.role === "buyer") {
      business = await Business.findOne({ ownerId: user._id });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        preferredLanguage: user.preferredLanguage,
      },
      profile,
      business,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to retrieve profile" });
  }
});
