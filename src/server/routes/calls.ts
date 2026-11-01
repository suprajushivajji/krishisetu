import { Router, Request, Response } from "express";
import { z } from "zod";
import { CallSession } from "../models/CallSession";
import { authenticate, optionalAuthenticate, AuthenticatedRequest } from "../middleware/auth";
import { OpenRouterService } from "../services/openrouter";
import { IntentRouter } from "../services/intentRouter";

export const callsRouter = Router();

// Generate unique session ID
function generateSessionId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// POST /api/v1/calls - Create a new call session
callsRouter.post("/", optionalAuthenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { language = "kn-IN", mode = "in_app", district = "", state = "Karnataka" } = req.body;

    const session = new CallSession({
      sessionId: generateSessionId(),
      userId: req.user?._id,
      mode,
      status: "created",
      language,
      startTime: new Date(),
      transcriptSegments: [],
      messageDeliveries: [],
      consentGiven: false,
      metadata: {
        district,
        state,
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      },
    });

    await session.save();

    res.status(201).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        language: session.language,
        startTime: session.startTime,
      },
    });
  } catch (error: any) {
    console.error("Error creating call session:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create call session" });
  }
});

// POST /api/v1/calls/:sessionId/start - Start the call
callsRouter.post("/:sessionId/start", optionalAuthenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await CallSession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ success: false, message: "Call session not found" });
      return;
    }

    if (session.userId && session.userId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    session.status = "connecting";
    await session.save();

    res.status(200).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        language: session.language,
      },
    });
  } catch (error: any) {
    console.error("Error starting call:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to start call" });
  }
});

// POST /api/v1/calls/:sessionId/end - End the call
callsRouter.post("/:sessionId/end", optionalAuthenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { finalTranscript, summary } = req.body;

    const session = await CallSession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ success: false, message: "Call session not found" });
      return;
    }

    if (session.userId && session.userId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

    session.status = "completed";
    session.endTime = endTime;
    session.duration = duration;
    if (finalTranscript) session.finalTranscript = finalTranscript;
    if (summary) session.summary = summary;

    await session.save();

    res.status(200).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        duration,
        finalTranscript: session.finalTranscript,
        summary: session.summary,
      },
    });
  } catch (error: any) {
    console.error("Error ending call:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to end call" });
  }
});

// GET /api/v1/calls - List user's calls
callsRouter.get("/", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const sessions = await CallSession.find({ userId: req.user?._id })
      .sort({ startTime: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .select("-transcriptSegments -messageDeliveries");

    const total = await CallSession.countDocuments({ userId: req.user?._id });

    res.status(200).json({
      success: true,
      sessions,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error("Error fetching calls:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch calls" });
  }
});

// GET /api/v1/calls/:sessionId - Get specific call
callsRouter.get("/:sessionId", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await CallSession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ success: false, message: "Call session not found" });
      return;
    }

    if (session.userId && session.userId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    res.status(200).json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error("Error fetching call:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch call" });
  }
});

// GET /api/v1/calls/:sessionId/transcript - Get transcript
callsRouter.get("/:sessionId/transcript", authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await CallSession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ success: false, message: "Call session not found" });
      return;
    }

    if (session.userId && session.userId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    // Sort transcript segments by sequence
    const sortedSegments = session.transcriptSegments.sort((a: any, b: any) => a.sequence - b.sequence);

    res.status(200).json({
      success: true,
      sessionId: session.sessionId,
      transcriptSegments: sortedSegments,
      finalTranscript: session.finalTranscript,
      summary: session.summary,
      duration: session.duration,
      language: session.language,
    });
  } catch (error: any) {
    console.error("Error fetching transcript:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch transcript" });
  }
});

// POST /api/v1/calls/:sessionId/transcript/segment - Add transcript segment
callsRouter.post("/:sessionId/transcript/segment", optionalAuthenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { speaker, text, language, isFinal = false, confidence } = req.body;

    const session = await CallSession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ success: false, message: "Call session not found" });
      return;
    }

    if (session.userId && session.userId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const sequence = session.transcriptSegments.length + 1;
    const segment = {
      speaker,
      text,
      language,
      sequence,
      startTime: new Date(),
      isFinal,
      confidence,
    };

    session.transcriptSegments.push(segment);
    await session.save();

    res.status(201).json({
      success: true,
      segment,
    });
  } catch (error: any) {
    console.error("Error adding transcript segment:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to add transcript segment" });
  }
});

// POST /api/v1/calls/:sessionId/send-transcript - Send transcript via messaging
callsRouter.post("/:sessionId/send-transcript", optionalAuthenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { provider, recipientPhone, message } = req.body;

    const session = await CallSession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ success: false, message: "Call session not found" });
      return;
    }

    if (session.userId && session.userId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    if (!session.consentGiven) {
      res.status(400).json({ success: false, message: "Consent not given for transcript delivery" });
      return;
    }

    // Check if provider is configured
    const isTwilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

    if (provider === "sms" && !isTwilioConfigured) {
      res.status(400).json({ success: false, message: "SMS provider not configured" });
      return;
    }

    // For manual WhatsApp, just generate the share link
    if (provider === "manual_whatsapp") {
      const whatsappUrl = `https://wa.me/${recipientPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`;
      
      const delivery = {
        provider: "manual_whatsapp",
        recipientPhone,
        status: "sent" as const,
        sentAt: new Date(),
      };

      session.messageDeliveries.push(delivery);
      await session.save();

      res.status(200).json({
        success: true,
        delivery,
        whatsappUrl,
      });
      return;
    }

    // TODO: Implement actual Twilio SMS/WhatsApp delivery
    res.status(501).json({
      success: false,
      message: "SMS and WhatsApp delivery not yet implemented",
    });
  } catch (error: any) {
    console.error("Error sending transcript:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to send transcript" });
  }
});

// POST /api/v1/calls/:sessionId/consent - Give consent for transcript delivery
callsRouter.post("/:sessionId/consent", optionalAuthenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await CallSession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ success: false, message: "Call session not found" });
      return;
    }

    if (session.userId && session.userId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    session.consentGiven = true;
    session.consentTimestamp = new Date();
    await session.save();

    res.status(200).json({
      success: true,
      consentGiven: true,
    });
  } catch (error: any) {
    console.error("Error recording consent:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to record consent" });
  }
});

// POST /api/v1/calls/:sessionId/generate-summary - Generate call summary using LLM
callsRouter.post("/:sessionId/generate-summary", optionalAuthenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await CallSession.findOne({ sessionId });
    if (!session) {
      res.status(404).json({ success: false, message: "Call session not found" });
      return;
    }

    if (session.userId && session.userId.toString() !== req.user?._id?.toString()) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    // Generate transcript text
    const transcriptText = session.transcriptSegments
      .map((seg: any) => `${seg.speaker}: ${seg.text}`)
      .join("\n");

    if (!transcriptText || transcriptText.length < 10) {
      res.status(400).json({ success: false, message: "Transcript too short to generate summary" });
      return;
    }

    // Generate summary using OpenRouter
    try {
      const prompt = `Summarize this call transcript in 2-3 sentences. Focus on the main request, key information discussed, and any actions completed. Do not invent information not present in the transcript.\n\nTranscript:\n${transcriptText}`;
      
      const summary = await OpenRouterService.generateResponse(prompt, session.language);
      
      session.summary = summary;
      await session.save();

      res.status(200).json({
        success: true,
        summary,
      });
    } catch (llmError) {
      console.warn("LLM summary generation failed:", llmError);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate summary using LLM. Summary generation requires OPENROUTER_API_KEY." 
      });
    }
  } catch (error: any) {
    console.error("Error generating summary:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to generate summary" });
  }
});
