import assert from "node:assert/strict";

/**
 * Voice business-registration test suite (KrishiSetu).
 * Run: npx tsx tests/voice-registration.test.ts
 *
 * All provider calls are MOCKED — no live Gnani/OpenRouter requests and no
 * real business registrations are created.
 */

import {
  CATEGORIES,
  CROPS_LIST,
  DISTRICTS_KARNATAKA,
  FIELD_IDS,
  FIELD_DEFINITIONS,
  REGISTRY_ORDER,
  initialRegistrationState,
  isRegisteredFieldId,
  validateField,
  validateForm,
  buildBusinessPayload,
  isStep1Complete,
  isStep2Complete,
  isStep3Complete,
  type RegistrationFormState,
  type RegistrationLanguage,
} from "../src/lib/registrationSchema";
import {
  deterministicExtract,
  extractPhone,
  normalizeSpokenDigits,
  normalizeQuantity,
  normalizeFieldValue,
  extractTextAnswer,
  matchCrops,
  matchCategory,
} from "../src/lib/registrationNormalization";
import {
  RegistrationConversationMachine,
  buildReviewText,
} from "../src/lib/registrationConversation";
import { FIELD_QUESTIONS, FIELD_LABELS, VALIDATION_MESSAGES, UI_STRINGS } from "../src/lib/registrationVoice";
import { OpenRouterService } from "../src/server/services/openrouter";
import { splitIntoSpeakChunks } from "../src/lib/browserTTS";
import { RegistrationExtractionService, parseModelUpdates } from "../src/server/services/registrationExtraction";
import { GnaniService } from "../src/server/services/gnani";
import { config } from "../src/server/config";

let passed = 0;
async function ok(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✅ ${name}`);
}

console.log("🧪 [Voice Registration Test Suite] Running...\n");

async function main() {
  // 1. Field registry covers every manual form field
  await ok("1. Field registry maps every manual form field", () => {
    const required = [
      "businessName", "category", "contactPerson", "phone", "email",
      "address", "district", "taluk", "locality", "pincode", "serviceCoverage",
      "selectedCrops", "minQuantityKg", "maxQuantityKg", "transportPreference", "paymentTerms", "description", "consentToPublish",
    ];
    for (const id of required) {
      assert.ok(FIELD_DEFINITIONS[id], `field '${id}' must be in registry`);
      assert.ok(FIELD_IDS.includes(id), `field '${id}' must be whitelisted`);
    }
    for (const id of FIELD_IDS) assert.ok([1, 2, 3].includes(FIELD_DEFINITIONS[id].step), `${id} step invalid`);
    assert.deepEqual(REGISTRY_ORDER[1].slice(0, 5), ["businessName", "category", "contactPerson", "phone", "email"]);
  });

  // 2. kn/hi/en mappings for every asked field + UI + validation strings
  await ok("2. Every field has kn-IN, hi-IN, en-IN question + label + UI strings", () => {
    const langs: RegistrationLanguage[] = ["kn-IN", "hi-IN", "en-IN"];
    for (const id of FIELD_IDS) {
      if (!FIELD_DEFINITIONS[id].askedByVoice) continue;
      for (const l of langs) {
        assert.ok(FIELD_QUESTIONS[id]?.[l], `${id} missing question for ${l}`);
        assert.ok(FIELD_LABELS[id]?.[l], `${id} missing label for ${l}`);
      }
    }
    for (const key of Object.keys(UI_STRINGS)) for (const l of langs) assert.ok(UI_STRINGS[key][l], `UI ${key} missing ${l}`);
    for (const key of Object.keys(VALIDATION_MESSAGES)) for (const l of langs) assert.ok(VALIDATION_MESSAGES[key][l], `validation ${key} missing ${l}`);
  });

  // 3. Multiple fields from one answer
  await ok("3. Multiple fields extracted from a single sentence", () => {
    const text = "I am Ravi, my mobile is 9845012345, email ravi@fresh.com, I am a wholesaler buying Tomato and Onion";
    const updates = deterministicExtract(text, "en-IN", initialRegistrationState);
    const ids = updates.map((u) => u.fieldId);
    for (const want of ["phone", "email", "category", "selectedCrops"]) assert.ok(ids.includes(want), `missing ${want}`);
    assert.deepEqual((updates.find((u) => u.fieldId === "selectedCrops")?.value as string[]).sort(), ["Onion", "Tomato"]);
    assert.equal(updates.find((u) => u.fieldId === "phone")?.value, "9845012345");
    assert.equal(updates.find((u) => u.fieldId === "category")?.value, "wholesaler");
  });

  // 3b. Free-text answers keep only the requested answer
  await ok("3b. Free-text field prefixes are removed", () => {
    assert.equal(
      extractTextAnswer("contactPerson", "contact person's name is Supraj"),
      "Supraj"
    );
    assert.equal(
      extractTextAnswer("businessName", "my business name: Bengaluru APMC"),
      "Bengaluru APMC"
    );
    assert.equal(
      extractTextAnswer("businessName", "the business name is bengaluru apmc"),
      "bengaluru apmc"
    );
    assert.equal(
      extractTextAnswer(
        "contactPerson",
        "the contact person name is supraj the contact person name is supraj"
      ),
      "supraj"
    );
    assert.equal(extractTextAnswer("contactPerson", "Supraj"), "Supraj");
  });

  // 4. Invalid phone/email + spoken digits
  await ok("4. Invalid phone / email rejected; spoken digits normalized", () => {
    assert.equal(validateField("phone", "12345", initialRegistrationState).ok, false);
    assert.equal(validateField("phone", "5845012345", initialRegistrationState).ok, false);
    assert.equal(validateField("phone", "9845012345", initialRegistrationState).ok, true);
    assert.equal(validateField("email", "not-an-email", initialRegistrationState).ok, false);
    assert.equal(validateField("email", "a@b.co", initialRegistrationState).ok, true);
    assert.equal(validateField("email", "", initialRegistrationState).ok, true);
    assert.equal(normalizeSpokenDigits("nine eight four five"), "9845");
    assert.equal(extractPhone("my number is nine eight four five zero one two three four five"), "9845012345");
  });

  // 5. Invalid category/crop + matching
  await ok("5. Invalid category / crop rejected, valid matched", () => {
    assert.equal(validateField("category", "goldsmith", initialRegistrationState).ok, false);
    assert.equal(validateField("category", "fpo", initialRegistrationState).ok, true);
    assert.equal(validateField("selectedCrops", ["Durian"], initialRegistrationState).ok, false);
    assert.equal(validateField("selectedCrops", ["Tomato"], initialRegistrationState).ok, true);
    assert.ok(CATEGORIES.every((c) => validateField("category", c.id, initialRegistrationState).ok));
    assert.ok(CROPS_LIST.every((c) => validateField("selectedCrops", [c], initialRegistrationState).ok));
    assert.ok(DISTRICTS_KARNATAKA.every((d) => validateField("district", d, initialRegistrationState).ok));
    assert.equal(matchCategory("a wholesale trader"), "wholesaler");
    assert.deepEqual(matchCrops("ಟೊಮೇಟೊ ಮತ್ತು ಈರುಳ್ಳಿ"), ["Tomato", "Onion"]);
  });

  // 6. Unclear answer re-ask then success
  await ok("6. Unclear answer triggers re-ask then success on retry", () => {
    const m = new RegistrationConversationMachine({ ...initialRegistrationState });
    m.selectLanguage("hi-IN");
    m.start();
    assert.equal(m.currentFieldId, "businessName");
    const bad = m.processAnswer("अजीब सा उत्तर", [], "voice");
    assert.ok(bad.errors.length > 0, "unclear answer must produce an error");
    assert.equal(m.currentFieldId, "businessName");
    const good = m.processAnswer("Sahaja Fresh Foods", [{ fieldId: "businessName", value: "Sahaja Fresh Foods" }], "typed");
    assert.ok(good.filled.includes("businessName"));
    assert.equal(m.formState.businessName, "Sahaja Fresh Foods");
  });

  // 7. Correct a previously filled field
  await ok("7. Previously filled field can be corrected later", () => {
    const m = new RegistrationConversationMachine({ ...initialRegistrationState });
    m.selectLanguage("en-IN");
    m.start();
    m.processAnswer("Ravi Wholesale", [{ fieldId: "businessName", value: "Ravi Wholesale" }], "typed");
    assert.ok(m.editField("businessName", "Ravi Fresh Agri", "typed").ok);
    assert.equal(m.formState.businessName, "Ravi Fresh Agri");
    assert.ok(!m.editField("phone", "12", "typed").ok, "invalid correction rejected");
  });

  // 8. Existing valid defaults are not asked again
  await ok("8. Voice flow advances after only missing required values", () => {
    const m = new RegistrationConversationMachine({ ...initialRegistrationState });
    m.selectLanguage("en-IN");
    m.start();
    fillStep1(m);
    assert.ok(isStep1Complete(m.formState));
    assert.equal(m.currentStep, 2);
    fillStep2(m);
    assert.ok(isStep2Complete(m.formState));
    assert.equal(m.status, "review");
    assert.ok(isStep3Complete(m.formState));
  });

  // 9. Switch to manual without data loss
  await ok("9. Switching to manual keeps filled values (no data loss)", () => {
    const m = new RegistrationConversationMachine({ ...initialRegistrationState });
    m.selectLanguage("kn-IN");
    m.start();
    m.processAnswer("ಸಹಜ ಫ್ರೆಶ್", [{ fieldId: "businessName", value: "ಸಹಜ ಫ್ರೆಶ್" }], "voice");
    const manualEdited: RegistrationFormState = { ...m.formState, phone: "9845012345", address: "Shop 12, APMC Yard" };
    m.syncFormState(manualEdited);
    assert.equal(m.formState.businessName, "ಸಹಜ ಫ್ರೆಶ್");
    assert.equal(m.formState.phone, "9845012345");
    assert.equal(m.formState.address, "Shop 12, APMC Yard");
    assert.ok(m.answered.has("phone"));
  });

  // 10. No submission before confirmation
  await ok("10. Submit blocked until explicit confirmation", () => {
    const m = fillAllSteps();
    assert.equal(m.status, "review");
    assert.throws(() => m.beginSubmit(), /Illegal transition/, "cannot submit before confirm");
    const softConfirm = m.confirm("maybe later please");
    assert.ok(!softConfirm.ok, "non-confirmation word does not submit");
    assert.equal(m.status, "review");
    assert.ok(m.confirm().ok, "explicit confirm accepted");
    assert.equal(m.status, "confirming");
  });

  // 11. Confirmed submission uses existing payload contract
  await ok("11. Confirmed submission uses existing /businesses payload contract", () => {
    const m = fillAllSteps();
    m.confirm();
    assert.ok(m.beginSubmit().ok);
    assert.equal(m.status, "submitting");
    const payload = buildBusinessPayload(m.formState, false);
    for (const key of ["businessName", "category", "contactPerson", "phone", "district", "cropsPurchased", "minQuantityKg", "maxQuantityKg", "transportPreference", "serviceCoverage", "paymentTerms", "consentToPublish", "latitude", "longitude", "preferredUnit", "isDraft"]) {
      assert.ok(key in payload, `payload missing ${key}`);
    }
    assert.equal((payload.cropsPurchased as string[]).length > 0, true);
    assert.equal(payload.preferredUnit, "kg");
    assert.equal(payload.isDraft, false);
  });

  // 12. Submission failure + recovery
  await ok("12. Submission failure returns to review and keeps details", () => {
    const m = fillAllSteps();
    m.confirm();
    m.beginSubmit();
    m.submitFailed();
    assert.equal(m.status, "review");
    assert.equal(m.formState.businessName, "Recovery Foods");
    assert.equal(validateForm(m.formState).length, 0);
    assert.ok(m.confirm().ok);
    assert.ok(m.beginSubmit().ok);
  });

  // 13. Repeated confirmation does not duplicate submission
  await ok("13. Double confirm/submit cannot re-enter submitting", () => {
    const m = fillAllSteps();
    m.confirm();
    assert.ok(m.beginSubmit().ok);
    assert.equal(m.status, "submitting");
    assert.throws(() => m.beginSubmit(), /Illegal transition/);
    assert.throws(() => m.confirm(), /Illegal transition/);
  });

  // 14. Missing Gnani credentials + empty TTS
  await ok("14. Gnani unconfigured STT returns demo; TTS rejects gracefully", async () => {
    const realKey = config.GNANI_API_KEY;
    (config as { GNANI_API_KEY: string }).GNANI_API_KEY = "";
    const t = await GnaniService.transcribe({ audioBuffer: Buffer.alloc(0), languageCode: "kn-IN" });
    assert.equal(t.provider, "unconfigured_demo");
    assert.equal(t.transcript, "");
    await assert.rejects(() => GnaniService.synthesize({ text: "hi", languageCode: "kn-IN" }), /not configured/i);
    (config as { GNANI_API_KEY: string }).GNANI_API_KEY = realKey;
  });

  // 15. OpenRouter failure does not change the selected model
  await ok("15. OpenRouter failure keeps exact model + deterministic fallback", async () => {
    const modelBefore = config.OPENROUTER_MODEL;
    const realChat = OpenRouterService.chat;
    OpenRouterService.chat = async () => {
      throw new Error("OpenRouter request failed: simulated outage");
    };
    const res = await RegistrationExtractionService.extract({
      transcript: "my phone is 9845012345",
      language: "en-IN",
      currentFieldId: "phone",
      formState: { ...initialRegistrationState },
    });
    assert.equal(config.OPENROUTER_MODEL, "nvidia/nemotron-3-ultra-550b-a55b:free");
    assert.equal(config.OPENROUTER_MODEL, modelBefore);
    assert.ok(res.modelError, "modelError surfaced");
    assert.equal(res.updates.find((u) => u.fieldId === "phone")?.value, "9845012345");
    OpenRouterService.chat = realChat;
  });

  await ok("15b. parseModelUpdates enforces whitelist, rejects invented coords/keys", () => {
    assert.ok(isRegisteredFieldId("phone"));
    assert.ok(!isRegisteredFieldId("evil"));
    const junk = `{"updates":[{"fieldId":"phone","value":"9845012345"},{"fieldId":"isVerified","value":true},{"fieldId":"latitude","value":12.9},{"fieldId":"confirm","value":true}]}`;
    const ids = parseModelUpdates(junk).map((p) => p.fieldId);
    assert.ok(ids.includes("phone"));
    assert.ok(!ids.includes("isVerified"));
    assert.ok(!ids.includes("latitude"), "model may not set coordinates");
    assert.ok(!ids.includes("confirm"), "model may not trigger confirm");
    assert.deepEqual(parseModelUpdates("not json at all"), []);
  });

  await ok("15c. Extraction merges model + deterministic, deterministic wins", async () => {
    const realChat = OpenRouterService.chat;
    OpenRouterService.chat = (async () => ({
      choices: [{ message: { content: JSON.stringify({ updates: [{ fieldId: "category", value: "exporter" }, { fieldId: "evil", value: 1 }] }) }, finish_reason: "stop" }],
      id: "x",
    })) as unknown as typeof OpenRouterService.chat;
    const res = await RegistrationExtractionService.extract({
      transcript: "I am a wholesaler buying tomato",
      language: "en-IN",
      currentFieldId: "category",
      formState: { ...initialRegistrationState },
    });
    const ids = res.updates.map((u) => u.fieldId);
    assert.ok(ids.includes("selectedCrops"));
    assert.equal(res.updates.find((u) => u.fieldId === "category")?.value, "wholesaler");
    assert.ok(!ids.includes("evil"));
    OpenRouterService.chat = realChat;
  });

  // 16. Audio/cancel lifecycle + no false location defaults
  await ok("16. Cancel stops flow and preserves captured data", () => {
    const m = new RegistrationConversationMachine({ ...initialRegistrationState });
    m.selectLanguage("en-IN");
    m.start();
    m.processAnswer("Green Valley", [{ fieldId: "businessName", value: "Green Valley" }], "typed");
    m.cancel();
    assert.equal(m.status, "cancelled");
    assert.equal(m.formState.businessName, "Green Valley");
  });

  await ok("16b. Values never silently default to false user location", () => {
    assert.equal(normalizeFieldValue("latitude", "somewhere", initialRegistrationState), null);
    assert.equal(normalizeFieldValue("longitude", "unknown", initialRegistrationState), null);
    assert.equal(validateField("latitude", Number.NaN, initialRegistrationState).ok, false);
    assert.equal(validateField("latitude", 200, initialRegistrationState).ok, false);
  });

  await ok("16c. Quantity normalization handles spoken + numeric + range", () => {
    assert.equal(normalizeQuantity("100"), 100);
    assert.equal(normalizeQuantity("two hundred"), 200);
    assert.equal(normalizeQuantity("2 thousand"), 2000);
    const range = deterministicExtract("I buy from 100 to 5000 kg daily", "en-IN", initialRegistrationState);
    assert.equal(range.find((u) => u.fieldId === "minQuantityKg")?.value, 100);
    assert.equal(range.find((u) => u.fieldId === "maxQuantityKg")?.value, 5000);
  });

  await ok("Review read-back is localized and reflects real form values", () => {
    const m = fillAllSteps();
    const text = buildReviewText(m.formState, "kn-IN");
    assert.ok(text.includes("Recovery Foods"));
    assert.ok(text.includes("9845012345"));
    assert.ok(buildReviewText(m.formState, "hi-IN").length > 20);
  });

  // Speech must never be cut off: long text is split into sub-cutoff chunks.
  await ok("Long spoken text is chunked to avoid TTS cutoff", () => {
    assert.deepEqual(splitIntoSpeakChunks(""), []);
    assert.deepEqual(splitIntoSpeakChunks("What is your business name?"), ["What is your business name?"]);
    // Sentence boundaries are preserved.
    const two = splitIntoSpeakChunks("ನಿಮ್ಮ ವ್ಯಾಪಾರದ ಹೆಸರು: Recovery Foods. ಸಂಪರ್ಕ: 9845012345.");
    assert.equal(two.length, 2);
    // A very long run-on string is broken into <=180-char pieces (under Chrome's ~15s limit).
    const long = "ಕನ್ನಡ ".repeat(120).trim();
    const parts = splitIntoSpeakChunks(long, 180);
    assert.ok(parts.length > 1, "long text must split into multiple chunks");
    assert.ok(parts.every((p) => p.length <= 180), "every chunk stays under the cutoff length");
    assert.equal(parts.join(" ").replace(/\s+/g, " "), long.replace(/\s+/g, " "), "no text is lost");
  });

  console.log(`\n🎉 ${passed} voice-registration scenarios passed.\n`);
}

// ===========================================================================
// helpers
// ===========================================================================
function fillStep1(m: RegistrationConversationMachine): void {
  m.processAnswer("Recovery Foods", [{ fieldId: "businessName", value: "Recovery Foods" }], "typed");
  m.processAnswer("Supraj Shivajji", [{ fieldId: "contactPerson", value: "Supraj Shivajji" }], "typed");
  m.processAnswer("9845012345", [{ fieldId: "phone", value: "9845012345" }], "typed");
}

function fillStep2(m: RegistrationConversationMachine): void {
  m.processAnswer("Shop 12 APMC Yard", [{ fieldId: "address", value: "Shop 12 APMC Yard" }], "typed");
}

function fillStep3(m: RegistrationConversationMachine): void {
  m.processAnswer("Tomato Onion", [{ fieldId: "selectedCrops", value: ["Tomato", "Onion"] }], "typed");
  m.processAnswer("200", [{ fieldId: "minQuantityKg", value: 200 }], "typed");
  m.processAnswer("8000", [{ fieldId: "maxQuantityKg", value: 8000 }], "typed");
  m.processAnswer("both", [{ fieldId: "transportPreference", value: "both" }], "typed");
  m.processAnswer("Immediate UPI", [{ fieldId: "paymentTerms", value: "Immediate UPI" }], "typed");
  m.processAnswer("skip", [{ fieldId: "description", value: "", skip: true }], "typed");
  m.processAnswer("yes", [{ fieldId: "consentToPublish", value: true }], "typed");
}

function fillAllSteps(): RegistrationConversationMachine {
  const m = new RegistrationConversationMachine({ ...initialRegistrationState });
  m.selectLanguage("en-IN");
  m.start();
  fillStep1(m);
  fillStep2(m);
  assert.equal(m.status, "review", "fillAllSteps should reach review");
  return m;
}

main().catch((err) => {
  console.error("❌ TEST FAILURE:", err?.message || err);
  process.exit(1);
});
