import { Router, Request, Response } from "express";
import { z } from "zod";
import { Appointment } from "../models/Appointment";
import { Business } from "../models/Business";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";

export const appointmentsRouter = Router();

// Generate unique appointment ID
function generateAppointmentId(): string {
  return `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const createAppointmentSchema = z.object({
  businessId: z.string().optional(),
  businessName: z.string().optional(),
  purpose: z.string().min(1, "Purpose is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  scheduledTime: z.string().min(1, "Scheduled time is required"),
  contactMethod: z.enum(["phone", "in_person", "video_call"]).default("phone"),
  crop: z.string().optional(),
  quantity: z.number().optional(),
  enquiryId: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/v1/appointments - Create appointment
appointmentsRouter.post("/", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validated = createAppointmentSchema.parse(req.body);

    const appointment = new Appointment({
      appointmentId: generateAppointmentId(),
      farmerId: req.user?._id,
      businessId: validated.businessId,
      businessName: validated.businessName,
      purpose: validated.purpose,
      scheduledDate: new Date(validated.scheduledDate),
      scheduledTime: validated.scheduledTime,
      contactMethod: validated.contactMethod,
      crop: validated.crop,
      quantity: validated.quantity,
      enquiryId: validated.enquiryId,
      notes: validated.notes,
      status: "pending",
      confirmationHistory: [
        {
          action: "created",
          timestamp: new Date(),
          actor: "farmer",
        },
      ],
    });

    await appointment.save();

    res.status(201).json({
      success: true,
      appointment: {
        appointmentId: appointment.appointmentId,
        purpose: appointment.purpose,
        scheduledDate: appointment.scheduledDate,
        scheduledTime: appointment.scheduledTime,
        status: appointment.status,
      },
    });
  } catch (error: any) {
    console.error("Error creating appointment:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create appointment" });
  }
});

// GET /api/v1/appointments - List user's appointments
appointmentsRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = 20, offset = 0, status } = req.query;

    const filter: any = { farmerId: req.user?._id };
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .sort({ scheduledDate: -1 })
      .limit(Number(limit))
      .skip(Number(offset));

    const total = await Appointment.countDocuments(filter);

    res.status(200).json({
      success: true,
      appointments,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch appointments" });
  }
});

// GET /api/v1/appointments/:id - Get specific appointment
appointmentsRouter.get("/:id", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findOne({ appointmentId: id });
    if (!appointment) {
      res.status(404).json({ success: false, message: "Appointment not found" });
      return;
    }

    if (appointment.farmerId && appointment.farmerId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    res.status(200).json({
      success: true,
      appointment,
    });
  } catch (error: any) {
    console.error("Error fetching appointment:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch appointment" });
  }
});

// PATCH /api/v1/appointments/:id/confirm - Confirm appointment
appointmentsRouter.patch("/:id/confirm", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findOne({ appointmentId: id });
    if (!appointment) {
      res.status(404).json({ success: false, message: "Appointment not found" });
      return;
    }

    if (appointment.farmerId && appointment.farmerId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    appointment.status = "confirmed";
    appointment.confirmationHistory?.push({
      action: "confirmed",
      timestamp: new Date(),
      actor: "farmer",
    });

    await appointment.save();

    res.status(200).json({
      success: true,
      appointment: {
        appointmentId: appointment.appointmentId,
        status: appointment.status,
      },
    });
  } catch (error: any) {
    console.error("Error confirming appointment:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to confirm appointment" });
  }
});

// PATCH /api/v1/appointments/:id/cancel - Cancel appointment
appointmentsRouter.patch("/:id/cancel", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findOne({ appointmentId: id });
    if (!appointment) {
      res.status(404).json({ success: false, message: "Appointment not found" });
      return;
    }

    if (appointment.farmerId && appointment.farmerId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    appointment.status = "cancelled";
    appointment.confirmationHistory?.push({
      action: "cancelled",
      timestamp: new Date(),
      actor: "farmer",
    });

    await appointment.save();

    res.status(200).json({
      success: true,
      appointment: {
        appointmentId: appointment.appointmentId,
        status: appointment.status,
      },
    });
  } catch (error: any) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to cancel appointment" });
  }
});
