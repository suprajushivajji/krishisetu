import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { config } from "../config";

/**
 * Gnani AI Speech API Integration Service
 * 
 * Prisma v2.5 endpoint: POST https://api.vachana.ai/stt/v3
 * Timbre v2.5 endpoint: POST https://api.vachana.ai/api/v1/tts/inference
 * 
 * Supported Indian language codes:
 * - kn-IN: Kannada (default)
 * - hi-IN: Hindi
 * - te-IN: Telugu
 * - ta-IN: Tamil
 * - en-IN: Indian English
 * - indic-auto: Auto-detect
 */

export interface TranscribeOptions {
  audioBuffer?: Buffer;
  filePath?: string;
  languageCode: string;
}

export interface TranscribeResult {
  transcript: string;
  detectedLanguage: string;
  confidence?: number;
  provider: "gnani" | "unconfigured_demo";
}

export interface SynthesizeOptions {
  text: string;
  languageCode?: string;
  voice?: string;
  voiceGender?: "female" | "male";
  audioFormat?: "wav" | "mp3";
}

export interface SynthesizeResult {
  audioBuffer: Buffer;
  contentType: string;
  provider: "gnani" | "unconfigured_demo";
}

export class GnaniService {
  private static isConfigured(): boolean {
    return Boolean(config.GNANI_API_KEY && config.GNANI_API_KEY.trim().length > 0);
  }

  /**
   * Helper to normalize language code to standard xx-IN format
   */
  private static normalizeLanguageCode(code: string): string {
    const clean = (code || "kn-IN").toLowerCase().trim();
    if (clean.includes("kn") || clean === "kannada") return "kn-IN";
    if (clean.includes("hi") || clean === "hindi") return "hi-IN";
    if (clean.includes("te") || clean === "telugu") return "te-IN";
    if (clean.includes("ta") || clean === "tamil") return "ta-IN";
    if (clean.includes("en") || clean === "english") return "en-IN";
    if (clean.includes("auto")) return "indic-auto";
    return clean.includes("-") ? clean : `${clean}-IN`;
  }

  /**
   * Get appropriate voice for language
   */
  private static getVoiceForLanguage(languageCode: string, voiceGender: "female" | "male" = "female"): string {
    const lang = this.normalizeLanguageCode(languageCode);
    const voiceMap: Record<string, { female: string; male: string }> = {
      "kn-IN": { female: "Saanvi", male: "Kavin" },
      "hi-IN": { female: "Nalini", male: "Deepak" },
      "en-IN": { female: "Kaveri", male: "Girish" },
      "te-IN": { female: "Suhana", male: "Lehara" },
      "ta-IN": { female: "Asmita", male: "Trisha" },
    };
    return voiceMap[lang]?.[voiceGender] || "Nalini";
  }

  /**
   * Transcribe speech using Gnani Prisma v2.5
   */
  public static async transcribe(options: TranscribeOptions): Promise<TranscribeResult> {
    const { audioBuffer, filePath, languageCode = "kn-IN" } = options;

    if (!this.isConfigured()) {
      return {
        transcript: "",
        detectedLanguage: languageCode,
        provider: "unconfigured_demo",
      };
    }

    try {
      const requestStartedAt = Date.now();
      const normalizedLang = this.normalizeLanguageCode(languageCode);
      if (audioBuffer && !this.isPcmWav(audioBuffer)) {
        throw new Error("STT audio must be a valid PCM WAV file.");
      }
      const form = new FormData();
      if (filePath) {
        form.append("audio_file", fs.createReadStream(filePath));
      } else if (audioBuffer) {
        form.append("audio_file", audioBuffer, {
          filename: "audio.wav",
          contentType: "audio/wav",
        });
      } else {
        throw new Error("No audio provided for transcription");
      }

      form.append("language_code", normalizedLang);

      const response = await axios.post("https://api.vachana.ai/stt/v3", form, {
        headers: {
          ...form.getHeaders(),
          "X-API-Key-ID": config.GNANI_API_KEY,
        },
        timeout: 15000,
      });
      console.info("[voice] Gnani STT completed", {
        milliseconds: Date.now() - requestStartedAt,
        bytes: audioBuffer?.length,
        language: normalizedLang,
        status: response.status,
      });

      const transcript =
        response.data?.transcript ||
        response.data?.data?.transcript ||
        response.data?.result ||
        response.data?.text ||
        "";

      return {
        transcript: (typeof transcript === "string" ? transcript : "").trim(),
        detectedLanguage: response.data?.detected_language || normalizedLang,
        confidence: response.data?.confidence,
        provider: "gnani",
      };
    } catch (error: any) {
      const providerError = error?.response?.data;
      console.error("❌ [Gnani Prisma STT Error]:", providerError || error?.message);
      const detail = typeof providerError === "string"
        ? providerError
        : providerError?.message || providerError?.error || error?.message || "Unknown error";
      throw new Error(
        `Gnani STT failed: ${detail}`
      );
    }

  }

  private static isPcmWav(buffer: Buffer): boolean {
    if (buffer.length < 44) return false;
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") return false;
    if (buffer.toString("ascii", 12, 16) !== "fmt ") return false;
    const audioFormat = buffer.readUInt16LE(20);
    const channels = buffer.readUInt16LE(22);
    const bitsPerSample = buffer.readUInt16LE(34);
    return audioFormat === 1 && channels === 1 && bitsPerSample === 16;
  }

  /**
   * Synthesize text to speech using Gnani Timbre v2.5
   */
  public static async synthesize(options: SynthesizeOptions): Promise<SynthesizeResult> {
    const { text, languageCode = "kn-IN", voice, audioFormat = "wav" } = options;

    if (!this.isConfigured()) {
      throw new Error("Gnani API key is not configured. Set GNANI_API_KEY in server environment.");
    }

    try {
      const requestStartedAt = Date.now();
      const normalizedLang = this.normalizeLanguageCode(languageCode);
      const voiceName = voice || this.getVoiceForLanguage(normalizedLang, options.voiceGender);
      
      const payload = {
        model: "timbre-v2.5",
        text: text.trim(),
        voice: voiceName,
        language: normalizedLang,
        speed: 1.0,
        audio_config: {
          sample_rate: 48000,
          num_channels: 1,
          sample_width: 2,
          encoding: "linear_pcm",
          container: audioFormat === "mp3" ? "mp3" : "wav",
        },
      };

      const response = await axios.post("https://api.vachana.ai/api/v1/tts/inference", payload, {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key-ID": config.GNANI_API_KEY,
        },
        responseType: "arraybuffer",
        timeout: 15000,
      });

      const upstreamContentType = String(response.headers["content-type"] || "");
      const isBinaryAudio = upstreamContentType.startsWith("audio/") || upstreamContentType === "application/octet-stream";
      if (!isBinaryAudio) {
        const body = Buffer.from(response.data).toString("utf8");
        throw new Error(`Gnani TTS returned ${upstreamContentType || "a non-audio response"}: ${body.slice(0, 240)}`);
      }

      const rawAudio = Buffer.from(response.data);
      
      // Check for empty audio
      if (rawAudio.length < 100) {
        throw new Error("Gnani TTS returned empty or insufficient audio data");
      }
      
      const audioBuffer = upstreamContentType === "application/octet-stream" && !rawAudio.subarray(0, 4).equals(Buffer.from("RIFF"))
        ? this.wrapPcmAsWav(rawAudio)
        : rawAudio;
      console.info("[voice] Gnani TTS completed", {
        milliseconds: Date.now() - requestStartedAt,
        bytes: audioBuffer.length,
        contentType: upstreamContentType,
        format: audioFormat,
        language: normalizedLang,
      });

      return {
        audioBuffer,
        contentType: audioFormat === "wav" ? "audio/wav" : "audio/mpeg",
        provider: "gnani",
      };
    } catch (error: any) {
      console.error("❌ [Gnani Timbre TTS Error]:", error?.response?.data ? error.response.data.toString() : error?.message);
      throw new Error(
        `Gnani TTS failed: ${error?.response?.data ? error.response.data.toString() : error?.message}`
      );
    }
  }

  private static wrapPcmAsWav(pcm: Buffer): Buffer {
    const sampleRate = 16000;
    const channels = 1;
    const bitsPerSample = 16;
    const usablePcm = pcm.length % 2 === 0 ? pcm : pcm.subarray(0, pcm.length - 1);
    const wav = Buffer.alloc(44 + usablePcm.length);

    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + usablePcm.length, 4);
    wav.write("WAVE", 8);
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(channels, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
    wav.writeUInt16LE(channels * (bitsPerSample / 8), 32);
    wav.writeUInt16LE(bitsPerSample, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(usablePcm.length, 40);
    usablePcm.copy(wav, 44);

    return wav;
  }
}
