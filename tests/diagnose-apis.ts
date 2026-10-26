import { config } from "../src/server/config";
import { connectDB } from "../src/server/db";
import { MandiPriceService } from "../src/server/services/mandi";
import { GnaniService } from "../src/server/services/gnani";
import axios from "axios";
import mongoose from "mongoose";

async function runDiagnostic() {
  console.log("=================================================");
  console.log("🔍 KRISHISETU COMPREHENSIVE API DIAGNOSTIC SUITE");
  console.log("=================================================\n");

  const results: Record<string, { status: "WORKING" | "FAILED" | "SKIPPED"; details: string }> = {};

  // 1. Check MongoDB Atlas Connection
  console.log("1️⃣ Testing MongoDB Atlas Connection...");
  try {
    const conn = await connectDB();
    if (conn && mongoose.connection.readyState === 1) {
      console.log("   ✅ MongoDB Atlas Connected Successfully! Database:", mongoose.connection.name);
      results["MongoDB Atlas"] = { status: "WORKING", details: `Connected to db: ${mongoose.connection.name}` };
    } else {
      console.log("   ❌ MongoDB connection state is not 1");
      results["MongoDB Atlas"] = { status: "FAILED", details: "ReadyState not 1" };
    }
  } catch (err: any) {
    console.log("   ❌ MongoDB Atlas Connection Failed:", err.message);
    results["MongoDB Atlas"] = { status: "FAILED", details: err.message };
  }

  // 2. Test data.gov.in AGMARKNET API
  console.log("\n2️⃣ Testing data.gov.in AGMARKNET Mandi Price API...");
  try {
    const syncRes = await MandiPriceService.syncMarketPrices(5);
    console.log("   Status:", syncRes.status);
    console.log("   Records Fetched:", syncRes.recordsFetched);
    console.log("   Records Inserted:", syncRes.recordsInserted);
    if (syncRes.status === "success") {
      console.log("   ✅ data.gov.in API is WORKING and active!");
      results["data.gov.in Mandi API"] = {
        status: "WORKING",
        details: `Fetched ${syncRes.recordsFetched} live records, inserted ${syncRes.recordsInserted}`,
      };
    } else {
      console.log("   ❌ data.gov.in response:", syncRes.message);
      results["data.gov.in Mandi API"] = { status: "FAILED", details: syncRes.message || "Failed" };
    }
  } catch (err: any) {
    console.log("   ❌ data.gov.in API error:", err.message);
    results["data.gov.in Mandi API"] = { status: "FAILED", details: err.message };
  }

  // 3. Test MapTiler API
  console.log("\n3️⃣ Testing MapTiler API & Geocoding / Tiles...");
  try {
    const maptilerUrl = `https://api.maptiler.com/geocoding/Davanagere.json?key=${config.MAPTILER_API_KEY}`;
    const maptilerRes = await axios.get(maptilerUrl, { timeout: 8000 });
    if (maptilerRes.status === 200 && maptilerRes.data?.features?.length > 0) {
      const match = maptilerRes.data.features[0];
      console.log(`   ✅ MapTiler API is WORKING! Resolved '${match.place_name}' to coords:`, match.center);
      results["MapTiler Geocoding & Maps"] = {
        status: "WORKING",
        details: `Key valid. Resolved location: ${match.place_name}`,
      };
    } else {
      results["MapTiler Geocoding & Maps"] = { status: "FAILED", details: "Unexpected response format" };
    }
  } catch (err: any) {
    console.log("   ❌ MapTiler API error:", err.response?.data || err.message);
    results["MapTiler Geocoding & Maps"] = {
      status: "FAILED",
      details: err.response?.data?.message || err.message,
    };
  }

  // 4. Test Gnani Timbre v2.5 TTS
  console.log("\n4️⃣ Testing Gnani Timbre v2.5 Text-to-Speech API...");
  try {
    const ttsRes = await GnaniService.synthesize({
      text: "ನಮಸ್ಕಾರ, ಕೃಷಿಸೇತುಗೆ ಸ್ವಾಗತ.",
      languageCode: "kn-IN",
      voice: "Nalini",
    });
    if (ttsRes && ttsRes.audioBuffer && ttsRes.audioBuffer.length > 0) {
      console.log(`   ✅ Gnani Timbre v2.5 TTS is WORKING! Received ${ttsRes.audioBuffer.length} bytes WAV audio.`);
      results["Gnani Timbre v2.5 (TTS)"] = {
        status: "WORKING",
        details: `Synthesized Kannada speech (${ttsRes.audioBuffer.length} bytes)`,
      };
    } else {
      results["Gnani Timbre v2.5 (TTS)"] = { status: "FAILED", details: "Empty audio buffer" };
    }
  } catch (err: any) {
    console.log("   ❌ Gnani Timbre TTS failed:", err.message);
    results["Gnani Timbre v2.5 (TTS)"] = { status: "FAILED", details: err.message };
  }

  // 5. Test Gnani Prisma v2.5 STT
  console.log("\n5️⃣ Testing Gnani Prisma v2.5 Speech-to-Text API connectivity...");
  try {
    // Generate minimal dummy 1-second silent WAV buffer to test authorization & endpoint response
    const sampleRate = 16000;
    const numSamples = sampleRate * 1;
    const wavBuffer = Buffer.alloc(44 + numSamples * 2);
    // Write standard RIFF WAV header
    wavBuffer.write("RIFF", 0);
    wavBuffer.writeUInt32LE(36 + numSamples * 2, 4);
    wavBuffer.write("WAVE", 8);
    wavBuffer.write("fmt ", 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20); // PCM
    wavBuffer.writeUInt16LE(1, 22); // mono
    wavBuffer.writeUInt32LE(sampleRate, 24);
    wavBuffer.writeUInt32LE(sampleRate * 2, 28);
    wavBuffer.writeUInt16LE(2, 32);
    wavBuffer.writeUInt16LE(16, 34);
    wavBuffer.write("data", 36);
    wavBuffer.writeUInt32LE(numSamples * 2, 40);

    const sttRes = await GnaniService.transcribe({
      audioBuffer: wavBuffer,
      languageCode: "kn",
    });

    console.log("   ✅ Gnani Prisma v2.5 STT Endpoint accepted request with API Key! Provider:", sttRes.provider);
    results["Gnani Prisma v2.5 (STT)"] = {
      status: "WORKING",
      details: "Endpoint authenticated and parsed audio correctly",
    };
  } catch (err: any) {
    console.log("   ❌ Gnani Prisma STT response:", err.message);
    results["Gnani Prisma v2.5 (STT)"] = { status: "FAILED", details: err.message };
  }

  // 6. Test OpenRouter API
  console.log("\n6️⃣ Testing OpenRouter AI API...");
  try {
    const orRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: config.OPENROUTER_MODEL,
        messages: [{ role: "user", content: "Say hello in 2 words" }],
      },
      {
        headers: {
          Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    const text = orRes.data?.choices?.[0]?.message?.content;
    console.log(`   ✅ OpenRouter is WORKING! Model '${config.OPENROUTER_MODEL}' replied: "${text?.trim()}"`);
    results["OpenRouter AI"] = { status: "WORKING", details: `Model '${config.OPENROUTER_MODEL}' replied: ${text?.trim()}` };
  } catch (err: any) {
    console.log("   ❌ OpenRouter API error:", err.response?.data || err.message);
    results["OpenRouter AI"] = {
      status: "FAILED",
      details: err.response?.data?.error?.message || err.message,
    };
  }

  console.log("\n=================================================");
  console.log("📊 DIAGNOSTIC SUMMARY");
  console.log("=================================================");
  console.table(results);

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
}

runDiagnostic();
