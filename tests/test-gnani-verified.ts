import axios from "axios";
import { config } from "../src/server/config";

async function testWorkingPayload() {
  const payload = {
    model: "timbre-v2.5",
    text: "ನಮಸ್ಕಾರ, ಕೃಷಿಸೇತುಗೆ ಸ್ವಾಗತ.",
    voice: "Nalini", // valid voice from supported list
    language_code: "kn-IN",
    audio_format: "wav",
  };

  try {
    console.log("Testing with model, text, voice, language_code...");
    const res = await axios.post("https://api.vachana.ai/api/v1/tts/inference", payload, {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key-ID": config.GNANI_API_KEY,
      },
      responseType: "arraybuffer",
      timeout: 15000,
    });
    console.log("🎉 GNANI TIMBRE TTS SUCCESS!");
    console.log("Status:", res.status);
    console.log("Audio Buffer Length:", res.data.length, "bytes");
  } catch (err: any) {
    if (err.response?.data) {
      console.log("Error response:", Buffer.isBuffer(err.response.data) ? err.response.data.toString() : JSON.stringify(err.response.data));
    } else {
      console.log("Error:", err.message);
    }
  }
}

testWorkingPayload();
