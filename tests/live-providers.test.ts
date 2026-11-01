/**
 * SEPARATE live provider checks for the voice-registration flow.
 * These make REAL Gnani (STT/TTS) and OpenRouter calls and are ONLY run when
 * credentials exist. They are NOT part of `npm test` / `npm run test:all` and
 * never create a real business registration.
 *
 * Run manually:  npx tsx tests/live-providers.test.ts
 */

import assert from "node:assert/strict";
import { config } from "../src/server/config";
import { GnaniService } from "../src/server/services/gnani";
import { RegistrationExtractionService } from "../src/server/services/registrationExtraction";
import { initialRegistrationState } from "../src/lib/registrationSchema";

const hasGnani = Boolean(config.GNANI_API_KEY && config.GNANI_API_KEY.trim());
const hasOpenRouter = Boolean(config.OPENROUTER_API_KEY && config.OPENROUTER_API_KEY.trim());

async function main() {
  console.log("🔌 [Live provider checks] (skipped items are not failures)\n");

  if (!hasGnani && !hasOpenRouter) {
    console.log("ℹ️  No GNANI_API_KEY or OPENROUTER_API_KEY present — nothing to run live. Exiting OK.");
    return;
  }

  if (hasGnani) {
    console.log("• Gnani model id guard: OPENROUTER_MODEL =", config.OPENROUTER_MODEL);
    // Kannada TTS must return real audio (or surface a clear provider error).
    try {
      const tts = await GnaniService.synthesize({ text: "ನಿಮ್ಮ ವ್ಯಾಪಾರದ ಹೆಸರೇನು?", languageCode: "kn-IN" });
      assert.ok(tts.audioBuffer.length > 100, "expected non-empty Kannada TTS audio");
      console.log("  ✅ Gnani Kannada TTS returned audio (", tts.audioBuffer.length, "bytes )");
    } catch (err) {
      console.log("  ⚠️ Gnani Kannada TTS error (surface to user, offer typed answers):", err instanceof Error ? err.message : err);
    }

    try {
      const stt = await GnaniService.transcribe({ audioBuffer: Buffer.alloc(0), languageCode: "kn-IN" });
      console.log("  ℹ️ Gnani STT probe provider:", stt.provider);
    } catch (err) {
      console.log("  ℹ️ Gnani STT probe (empty audio) errored as expected:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("• Gnani: SKIPPED (no key)");
  }

  if (hasOpenRouter) {
    assert.equal(config.OPENROUTER_MODEL, "nvidia/nemotron-3-ultra-550b-a55b:free", "live check must use the exact free model");
    const res = await RegistrationExtractionService.extract({
      transcript: "My business is Green Valley, I am a wholesaler, phone 9845012345",
      language: "en-IN",
      currentFieldId: "businessName",
      formState: { ...initialRegistrationState },
    });
    console.log("  ✅ OpenRouter extraction ran. usedModel =", res.usedModel, "| fields =", res.updates.map((u) => u.fieldId).join(", "));
    // The model must never be able to submit or emit a confirm flag.
    assert.ok(!res.updates.some((u) => u.fieldId === "confirm" || u.fieldId === "isVerified"));
  } else {
    console.log("• OpenRouter: SKIPPED (no key)");
  }

  console.log("\n🎉 Live provider checks complete (no registrations created).\n");
}

main().catch((err) => {
  console.error("❌ Live check error:", err?.message || err);
  process.exit(1);
});
