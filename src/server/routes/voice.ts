import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { GnaniService } from "../services/gnani";
import { VoiceInteraction } from "../models/VoiceInteraction";
import { MarketPrice } from "../models/MarketPrice";
import { Business } from "../models/Business";
import { BuyerOffer } from "../models/BuyerOffer";
import { Market } from "../models/Market";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { calculateNetReturn } from "../utils/calculator";
import { IntentRouter } from "../services/intentRouter";
import { CropPredictionService } from "../services/cropPrediction";
import { WeatherService } from "../services/weather";

export const voiceRouter = Router();

// Store temporary audio in memory buffer for validation and forwarding
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("audio/") ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.match(/\.(wav|mp3|ogg|webm|m4a)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid audio file format. Supported: WAV, MP3, WEBM, OGG, M4A"));
    }
  },
});

const speakSchema = z.object({
  text: z.string().min(1, "Text is required to synthesize"),
  languageCode: z.string().default("kn-IN"),
  voiceGender: z.enum(["female", "male"]).default("female"),
});

const assistantSchema = z.object({
  transcript: z.string().min(1, "Transcript is required"),
  languageCode: z.string().default("kn-IN"),
  district: z.string().default("Davanagere"),
});

/**
 * POST /api/v1/voice/transcribe
 * Gnani Prisma v2.5 Speech-to-Text
 */
voiceRouter.post(
  "/transcribe",
  upload.single("audio"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: "Audio file is required ('audio' field)" });
        return;
      }

      const languageCode = (req.body.languageCode as string) || "kn";
      const userConsent = req.body.userConsent !== "false";

      const result = await GnaniService.transcribe({
        audioBuffer: req.file.buffer,
        languageCode,
      });

      if (result.provider === "unconfigured_demo") {
        res.status(503).json({
          success: false,
          message: "GNANI_API_KEY is not configured on the server. Add it to .env and restart the API.",
        });
        return;
      }

      // If user consents, log voice interaction
      if (userConsent && result.transcript) {
        await VoiceInteraction.create({
          language: languageCode,
          transcript: result.transcript,
          userConsented: true,
        });
      }

      res.status(200).json({
        success: true,
        transcript: result.transcript,
        detectedLanguage: result.detectedLanguage,
        provider: result.provider,
        message: undefined,
      });
    } catch (error: any) {
      console.error("❌ Voice transcribe error:", error);
      
      // Specific handling for 400 errors (likely audio format issues)
      if (error?.response?.status === 400) {
        res.status(400).json({
          success: false,
          message: "Audio format not supported by Gnani API. Please ensure audio is in WAV format (16kHz, mono, PCM).",
          error: error?.response?.data?.message || error?.message,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        message: error.message || "Failed to transcribe audio",
      });
    }
  }
);

/**
 * POST /api/v1/voice/speak
 * Gnani Timbre v2.5 Text-to-Speech
 */
voiceRouter.post("/speak", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, languageCode = "kn-IN", voiceGender = "female" } = req.body;
    if (!text) {
      res.status(400).json({ success: false, message: "Text to speak is required" });
      return;
    }

    try {
      const result = await GnaniService.synthesize({
        text,
        languageCode,
        voice: voiceGender === "male" ? "Girish" : "Nalini",
      });

      res.set({
        "Content-Type": result.contentType,
        "Content-Length": result.audioBuffer.length,
      });
      res.status(200).send(result.audioBuffer);
    } catch (apiError: any) {
      res.status(502).json({
        success: false,
        message: apiError.message || "Gnani speech service rejected the request.",
        isConfigured: Boolean(process.env.GNANI_API_KEY),
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to synthesize speech" });
  }
});

/**
 * POST /api/v1/voice/assistant
 * End-to-end voice query intent resolution with real database data & Kannada response
 */
voiceRouter.post("/assistant", async (req: Request, res: Response): Promise<void> => {
  try {
    const { transcript, languageCode = "kn-IN", district = "" } = req.body;

    // Classify intent (now async to fetch crops from DB)
    const intentResult = await IntentRouter.classify(transcript, district, "Karnataka");

    // Execute intent and retrieve data
    const data = await IntentRouter.execute(intentResult);

    // Generate response based on intent and data
    let answerText = "";
    let answerTextKannada = "";

    if (intentResult.intent === "clarification_required") {
      const missingFields = intentResult.missingFields.join(" and ");
      const availableCrops = await MarketPrice.distinct("commodity");
      const cropList = availableCrops.slice(0, 8).join(", ");
      answerText = `Please specify the ${missingFields}. Available crops: ${cropList}.`;
      answerTextKannada = `ದಯವಿಟ್ಟು ${missingFields} ಅನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ. ಲಭ್ಯವಿರುವ ಬೆಳೆಗಳು: ${cropList}.`;
    } else if (intentResult.intent === "crop_price") {
      if (data.found) {
        answerText = `${data.crop} is ₹${data.modalPricePerKg} per kg at ${data.market}, ${data.district}. Reported on ${new Date(data.arrivalDate).toLocaleDateString()}.`;
        answerTextKannada = `${data.market}, ${data.district} ನಲ್ಲಿ ${data.crop} ಮಾದರಿ ದರ ಪ್ರತಿ ಕಿಲೋಗೆ ₹${data.modalPricePerKg}. ${new Date(data.arrivalDate).toLocaleDateString()} ರಂದು ವರದಿ.`;
      } else {
        answerText = data.message || "No price record found for this crop.";
        answerTextKannada = data.message || "ಈ ಬೆಳೆಗೆ ದರ ದಾಖಲೆ ಸಿಗಲಿಲ್ಲ.";
      }
    } else if (intentResult.intent === "buyer_search") {
      if (data.found) {
        answerText = `Found ${data.count} active buyers. ${data.buyers[0]?.name} in ${data.buyers[0]?.district} is ${data.buyers[0]?.verified ? "verified" : "pending verification"}.`;
        answerTextKannada = `${data.count} ಸಕ್ರಿಯ ಖರೀದಿದಾರರು ಲಭ್ಯವಿದ್ದಾರೆ. ${data.buyers[0]?.district} ನಲ್ಲಿ ${data.buyers[0]?.name}.`;
      } else {
        answerText = "No active buyers found for this crop in your area.";
        answerTextKannada = "ಈ ಬೆಳೆಗೆ ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಸಕ್ರಿಯ ಖರೀದಿದಾರರು ಸಿಗಲಿಲ್ಲ.";
      }
    } else if (intentResult.intent === "net_return_calculation") {
      if (data.calculation) {
        const cropUsed = data.cropUsed || data.priceData?.crop || "crop";
        answerText = `For ${data.quantityKg} kg of ${cropUsed} at ₹${data.priceData.modalPricePerKg}/kg, estimated take-home is ₹${data.calculation.estimatedNetReturn}.`;
        answerTextKannada = `${data.quantityKg} ಕಿಲೋ ${cropUsed}ಗೆ ₹${data.priceData.modalPricePerKg}/kg ದರದಲ್ಲಿ, ಅಂದಾಜು ನಿವ್ವಳ: ₹${data.calculation.estimatedNetReturn}.`;
      } else {
        answerText = data.error || "Cannot calculate without current price data.";
        answerTextKannada = data.error || "ಪ್ರಸ್ತುತ ದರ ದತ್ತಾಂಶವಿಲ್ಲದೆ ಲೆಕ್ಕ ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.";
      }
    } else if (intentResult.intent === "crop_price_prediction") {
      if (data.sufficiencyStatus === "insufficient") {
        answerText = `Insufficient historical data for prediction. Only ${data.availableObservations} observations available. Current price: ₹${data.lastObservedPrice}/kg from ${new Date(data.lastObservedDate).toLocaleDateString()}.`;
        answerTextKannada = `ಊಹೆಗೆ ಅಸಮರ್ಪಕ ಐತಿಹಾಸಿಕ ದತ್ತಾಂಶ. ಕೇವಲ ${data.availableObservations} ವೀಕ್ಷಣಗಳು. ಪ್ರಸ್ತುತ ದರ: ₹${data.lastObservedPrice}/kg.`;
      } else {
        answerText = `Based on historical data, forecast is ₹${data.forecastValue}/kg for next ${data.forecastHorizon} days. ${data.limitations.join(". ")}`;
        answerTextKannada = `ಐತಿಹಾಸಿಕ ದತ್ತಾಂಶದ ಆಧಾರದ ಮೇಲೆ, ಮುಂದಿನ ${data.forecastHorizon} ದಿನಗಳಿಗೆ ₹${data.forecastValue}/kg ಊಹೆ.`;
      }
    } else if (intentResult.intent === "weather_forecast") {
      if (data.sufficiencyStatus === "insufficient") {
        answerText = "Weather service not yet configured.";
        answerTextKannada = "ಹವಾಮಾನ ಸೇವೆ ಇನ್ನೂ ಸಂರಚಿಸಲಾಗಿಲ್ಲ.";
      } else {
        answerText = `Current temperature: ${data.current.temperature}°C. ${data.current.description}.`;
        answerTextKannada = `ಪ್ರಸ್ತುತ ತಾಪಮಾನ: ${data.current.temperature}°C. ${data.current.description}.`;
      }
    } else {
      answerText = "I can help with crop prices, buyer search, earnings calculation, and more. Please ask a specific question.";
      answerTextKannada = "ನಾನು ಬೆಳೆ ದರಗಳು, ಖರೀದಿದಾರರು, ಲಾಭದ ಲೆಕ್ಕಾಚಾರ ಮುಂತಾದವುಗಳಲ್ಲಿ ಸಹಾಯ ಮಾಡಬಹುದು. ದಯವಿಟ್ಟು ನಿರ್ದಿಷ್ಟ ಪ್ರಶ್ನೆ ಕೇಳಿ.";
    }

    res.status(200).json({
      success: true,
      transcript,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      response: languageCode === "kn-IN" ? answerTextKannada : answerText,
      responseEnglish: answerText,
      responseKannada: answerTextKannada,
      data,
      intentResult,
    });
  } catch (error: any) {
    console.error("❌ Voice assistant error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process voice assistant query" });
  }
});
