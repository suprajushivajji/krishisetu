import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { GnaniService } from "../services/gnani";
import { VoiceInteraction } from "../models/VoiceInteraction";
import { MarketPrice } from "../models/MarketPrice";
import { Business } from "../models/Business";
import { BuyerOffer } from "../models/BuyerOffer";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { calculateNetReturn } from "../utils/calculator";
import {
  localizedCrop,
  localizedCropList,
  localizedMoney,
  normalizeVoiceLanguage,
  numberWords,
  findCropInTranscript,
} from "../services/voiceLocalization";

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
  languageCode: z.string().default("kn"),
  voiceGender: z.enum(["female", "male"]).default("female"),
});

const assistantSchema = z.object({
  transcript: z.string().min(1, "Transcript is required"),
  languageCode: z.string().default("kn"),
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
    const { text, languageCode = "kn", voiceGender = "female" } = req.body;
    if (!text) {
      res.status(400).json({ success: false, message: "Text to speak is required" });
      return;
    }

    try {
      const result = await GnaniService.synthesize({
        text,
        languageCode,
        voiceGender,
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
    const { transcript, languageCode = "kn", district = "" } = req.body;
    const responseLanguage = normalizeVoiceLanguage(languageCode);
    const lower = (transcript || "").toLowerCase();
    const isPriceQuery =
      lower.includes("rate") ||
      lower.includes("price") ||
      lower.includes("कीमत") ||
      lower.includes("भाव") ||
      lower.includes("दाम") ||
      lower.includes("ಬೆಲೆ") ||
      lower.includes("ದರ") ||
      lower.includes("ಭಾವ");

    const isBuyerQuery =
      lower.includes("buyer") ||
      lower.includes("kharidi") ||
      lower.includes("ಖರೀದಿದಾರ") ||
      lower.includes("ವ್ಯಾಪಾರಿ") ||
      lower.includes("ಮಂಡಿ");

    const isEarningsQuery =
      lower.includes("earnings") ||
      lower.includes("calculate") ||
      lower.includes("ಲಾಭ") ||
      lower.includes("ಲೆಕ್ಕ");

    const quantityMatch = lower.match(/(\d+(?:\.\d+)?)\s*(kg|ಕಿಲೋ|ಕೆಜಿ)/i);
    const distanceMatch = lower.match(/(\d+(?:\.\d+)?)\s*(km|ಕಿಮೀ)/i);
    const quantityKg = quantityMatch ? Number(quantityMatch[1]) : 500;
    const distanceKm = distanceMatch ? Number(distanceMatch[1]) : 0;
    const knownCrops = await MarketPrice.distinct("commodity");
    const detectedCrop = findCropInTranscript(knownCrops, transcript || "");
    const districtFilter = district ? { district: { $regex: new RegExp(String(district), "i") } } : {};
    const cropFilter = detectedCrop ? { commodity: { $regex: new RegExp(String(detectedCrop), "i") } } : {};
    const benchmark = detectedCrop
      ? await MarketPrice.findOne({ ...cropFilter, ...districtFilter }).sort({ arrivalDate: -1 }) ||
        await MarketPrice.findOne(cropFilter).sort({ arrivalDate: -1 })
      : null;

    let intent = "check_price";
    let answerText = "";
    let answerTextKannada = "";
    let answerTextHindi = "";
    let dataPayload: any = { crop: detectedCrop || null, district: district || null };

    if (!detectedCrop) {
      answerText = `Please mention the crop you want to know about. I can answer for ${knownCrops.slice(0, 8).join(", ")}.`;
      answerTextKannada = `ದಯವಿಟ್ಟು ಬೆಳೆಯ ಹೆಸರನ್ನು ಹೇಳಿ. ${localizedCropList(knownCrops.slice(0, 8), "kn")} ಬೆಳೆಗಳ ಬಗ್ಗೆ ನಾನು ಮಾಹಿತಿ ನೀಡಬಹುದು.`;
      answerTextHindi = `कृपया फसल का नाम बताइए। मैं ${localizedCropList(knownCrops.slice(0, 8), "hi")} के बारे में जानकारी दे सकता हूँ।`;
    } else if (isBuyerQuery) {
      intent = "find_buyers";
      const buyerFilter: any = { cropsPurchased: { $regex: new RegExp(detectedCrop, "i") }, isActive: true };
      if (district) buyerFilter.$or = [{ district: { $regex: new RegExp(district, "i") } }, { serviceDistricts: district }, { serviceCoverage: "statewide" }];
      const businesses = await Business.find(buyerFilter).limit(5);
      dataPayload = { ...dataPayload, buyersCount: businesses.length, buyers: businesses.map((business) => ({ name: business.businessName, phone: business.phone, district: business.district })) };
      answerText = businesses.length > 0
        ? `Found ${businesses.length} active buyers for ${detectedCrop}${district ? ` near ${district}` : ""}. The first listed buyer is ${businesses[0].businessName}.`
        : `No active buyer listing was found for ${detectedCrop}${district ? ` in ${district}` : ""}. Try widening the district search or register a buyer offer.`;
      answerTextKannada = businesses.length > 0
        ? `${detectedCrop} ಖರೀದಿಸುವ ${businesses.length} ಸಕ್ರಿಯ ವ್ಯಾಪಾರಿಗಳು ಲಭ್ಯವಿದ್ದಾರೆ. ಮೊದಲ ವ್ಯಾಪಾರಿ ${businesses[0].businessName}.`
        : `${detectedCrop}ಗೆ ಸಕ್ರಿಯ ವ್ಯಾಪಾರಿ ಪಟ್ಟಿ ಸಿಗಲಿಲ್ಲ. ಹತ್ತಿರದ ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಹುಡುಕಿ.`;
      answerTextHindi = businesses.length > 0
        ? `${detectedCrop} खरीदने वाले ${businesses.length} सक्रिय व्यापारी उपलब्ध हैं। पहला व्यापारी ${businesses[0].businessName} है।`
        : `${detectedCrop} के लिए सक्रिय व्यापारी सूची नहीं मिली। पास के जिलों में खोजें।`;
    } else if (isEarningsQuery) {
      intent = "calculate_earnings";
      if (!benchmark) {
        answerText = `I could not find a current market price for ${detectedCrop}, so I will not invent an earnings estimate.`;
        answerTextKannada = `${detectedCrop}ಗೆ ಪ್ರಸ್ತುತ ಮಾರುಕಟ್ಟೆ ದರ ಸಿಗಲಿಲ್ಲ. ಆದ್ದರಿಂದ ನಾನು ಅಂದಾಜು ಲಾಭವನ್ನು ಕಲ್ಪಿಸುವುದಿಲ್ಲ.`;
        answerTextHindi = `${detectedCrop} के लिए वर्तमान बाज़ार भाव नहीं मिला, इसलिए मैं अनुमानित कमाई नहीं बताऊँगा।`;
      } else {
        const calculation = calculateNetReturn({ pricePerKg: benchmark.modalPricePerKg, quantityKg, distanceKm, handlingCostPerKg: 1.2 });
        dataPayload = { ...dataPayload, modalPricePerKg: benchmark.modalPricePerKg, calculation };
        answerText = `For ${quantityKg} kg of ${detectedCrop} at the current modal price of ₹${benchmark.modalPricePerKg} per kg, estimated take-home is ₹${calculation.estimatedNetReturn}.`;
        answerTextKannada = `${quantityKg} ಕಿಲೋ ${detectedCrop}ಗೆ ಪ್ರಸ್ತುತ ಮಾದರಿ ದರ ₹${benchmark.modalPricePerKg} ಪ್ರತಿ ಕಿಲೋ. ಅಂದಾಜು ನಿವ್ವಳ ಮೊತ್ತ ₹${calculation.estimatedNetReturn}.`;
        answerTextHindi = `${quantityKg} किलो ${detectedCrop} के लिए वर्तमान मॉडल भाव ${benchmark.modalPricePerKg} रुपये प्रति किलो है। अनुमानित शुद्ध राशि ${calculation.estimatedNetReturn} रुपये है।`;
      }
    } else if (isPriceQuery || benchmark) {
      intent = "check_price";
      if (!benchmark) {
        answerText = `No current market record was found for ${detectedCrop}.`;
        answerTextKannada = `${detectedCrop}ಗೆ ಪ್ರಸ್ತುತ ಮಾರುಕಟ್ಟೆ ದಾಖಲೆ ಸಿಗಲಿಲ್ಲ.`;
        answerTextHindi = `${detectedCrop} के लिए वर्तमान बाज़ार रिकॉर्ड नहीं मिला।`;
      } else {
        const minimum = (benchmark.minPrice / 100).toFixed(2);
        const maximum = (benchmark.maxPrice / 100).toFixed(2);
        dataPayload = { ...dataPayload, modalPricePerKg: benchmark.modalPricePerKg, market: benchmark.market, date: benchmark.arrivalDate };
        answerText = `${detectedCrop} is ₹${benchmark.modalPricePerKg} per kg at ${benchmark.market}. The reported range is ₹${minimum} to ₹${maximum} per kg.`;
        answerTextKannada = `${benchmark.market} ನಲ್ಲಿ ${detectedCrop} ಮಾದರಿ ದರ ಪ್ರತಿ ಕಿಲೋಗೆ ₹${benchmark.modalPricePerKg}. ವರದಿ ದರ ₹${minimum} ರಿಂದ ₹${maximum} ಪ್ರತಿ ಕಿಲೋ.`;
        answerTextHindi = `${benchmark.market} में ${detectedCrop} का मॉडल भाव ${benchmark.modalPricePerKg} रुपये प्रति किलो है। रिपोर्ट किया गया भाव ${minimum} से ${maximum} रुपये प्रति किलो है।`;
      }
    }

    const localizedName = localizedCrop(detectedCrop || "", responseLanguage);
    let localizedResponse = answerText;
    if (responseLanguage === "kn") {
      if (!detectedCrop) {
        localizedResponse = answerTextKannada;
      } else if (intent === "find_buyers") {
        const buyersCount = Number(dataPayload.buyersCount || 0);
        localizedResponse = dataPayload.buyersCount > 0
          ? `${localizedName} ಖರೀದಿಸುವ ${numberWords(buyersCount, "kn")} ಸಕ್ರಿಯ ವ್ಯಾಪಾರಿಗಳು ಲಭ್ಯವಿದ್ದಾರೆ. ಮೊದಲ ವ್ಯಾಪಾರಿ ${dataPayload.buyers?.[0]?.name || ""}.`
          : `${localizedName}ಗೆ ಸಕ್ರಿಯ ವ್ಯಾಪಾರಿ ಪಟ್ಟಿ ಸಿಗಲಿಲ್ಲ. ಹತ್ತಿರದ ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಹುಡುಕಿ.`;
      } else if (intent === "calculate_earnings" && benchmark) {
        localizedResponse = `${numberWords(quantityKg, "kn")} ಕಿಲೋಗ್ರಾಂ ${localizedName}ಗೆ ಪ್ರಸ್ತುತ ಮಾದರಿ ದರ ${localizedMoney(benchmark.modalPricePerKg, "kn")} ಪ್ರತಿ ಕಿಲೋಗ್ರಾಂ. ಅಂದಾಜು ನಿವ್ವಳ ಮೊತ್ತ ${localizedMoney(dataPayload.calculation.estimatedNetReturn, "kn")}.`;
      } else if (benchmark) {
        localizedResponse = `${benchmark.market} ನಲ್ಲಿ ${localizedName} ಮಾದರಿ ದರ ಪ್ರತಿ ಕಿಲೋಗ್ರಾಂಗೆ ${localizedMoney(benchmark.modalPricePerKg, "kn")}. ವರದಿ ದರ ${localizedMoney(Number((benchmark.minPrice / 100).toFixed(2)), "kn")} ರಿಂದ ${localizedMoney(Number((benchmark.maxPrice / 100).toFixed(2)), "kn")} ಪ್ರತಿ ಕಿಲೋಗ್ರಾಂ.`;
      } else {
        localizedResponse = answerTextKannada.replace(detectedCrop, localizedName);
      }
    } else if (responseLanguage === "hi") {
      if (!detectedCrop) {
        localizedResponse = answerTextHindi;
      } else if (intent === "find_buyers") {
        const buyersCount = Number(dataPayload.buyersCount || 0);
        localizedResponse = dataPayload.buyersCount > 0
          ? `${localizedName} खरीदने वाले ${numberWords(buyersCount, "hi")} सक्रिय व्यापारी उपलब्ध हैं। पहला व्यापारी ${dataPayload.buyers?.[0]?.name || ""} है।`
          : `${localizedName} के लिए सक्रिय व्यापारी सूची नहीं मिली। पास के जिलों में खोजें।`;
      } else if (intent === "calculate_earnings" && benchmark) {
        localizedResponse = `${numberWords(quantityKg, "hi")} किलोग्राम ${localizedName} के लिए वर्तमान मॉडल भाव ${localizedMoney(benchmark.modalPricePerKg, "hi")} प्रति किलोग्राम है। अनुमानित शुद्ध राशि ${localizedMoney(dataPayload.calculation.estimatedNetReturn, "hi")} है।`;
      } else if (benchmark) {
        localizedResponse = `${benchmark.market} में ${localizedName} का मॉडल भाव ${localizedMoney(benchmark.modalPricePerKg, "hi")} प्रति किलोग्राम है। रिपोर्ट किया गया भाव ${localizedMoney(Number((benchmark.minPrice / 100).toFixed(2)), "hi")} से ${localizedMoney(Number((benchmark.maxPrice / 100).toFixed(2)), "hi")} प्रति किलोग्राम है।`;
      } else {
        localizedResponse = answerTextHindi.replace(detectedCrop, localizedName);
      }
    }

    res.status(200).json({
      success: true,
      transcript,
      intent,
      response: localizedResponse,
      responseEnglish: answerText,
      responseKannada: answerTextKannada,
      responseHindi: answerTextHindi,
      data: dataPayload,
    });
  } catch (error: any) {
    console.error("❌ Voice assistant error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to process voice assistant query" });
  }
});
