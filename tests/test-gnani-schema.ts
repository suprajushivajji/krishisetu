import axios from "axios";
import { config } from "../src/server/config";

async function inspectGnani() {
  const payloads = [
    {
      label: "Payload 1: language kn-IN",
      payload: {
        model: "timbre-v2.5",
        input: "ನಮಸ್ಕಾರ",
        language: "kn-IN",
        gender: "female",
        audio_config: { audio_encoding: "LINEAR16", sample_rate_hertz: 16000 },
      },
    },
    {
      label: "Payload 2: language_code kn-IN",
      payload: {
        model: "timbre-v2.5",
        text: "ನಮಸ್ಕಾರ",
        language_code: "kn-IN",
        gender: "female",
      },
    },
    {
      label: "Payload 3: input text object",
      payload: {
        input: { text: "ನಮಸ್ಕಾರ" },
        voice: { language_code: "kn-IN", gender: "female" },
        audio_config: { audio_encoding: "LINEAR16" },
      },
    },
  ];

  for (const p of payloads) {
    try {
      console.log(`\nTesting ${p.label}...`);
      const res = await axios.post("https://api.vachana.ai/api/v1/tts/inference", p.payload, {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key-ID": config.GNANI_API_KEY,
        },
        timeout: 10000,
      });
      console.log("Success! Status:", res.status, "Data keys:", Object.keys(res.data));
    } catch (err: any) {
      if (err.response?.data) {
        console.log("Response body:", Buffer.isBuffer(err.response.data) ? err.response.data.toString() : JSON.stringify(err.response.data));
      } else {
        console.log("Error:", err.message);
      }
    }
  }
}

inspectGnani();
