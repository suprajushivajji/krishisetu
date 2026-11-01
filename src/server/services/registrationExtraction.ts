/**
 * Voice business-registration extraction service.
 *
 * Uses the EXISTING free OpenRouter model (config.OPENROUTER_MODEL =
 * nvidia/nemotron-3-ultra-550b-a55b:free) to PROPOSE form-field updates from a
 * transcript, then merges deterministic extraction. It NEVER mutates arbitrary
 * keys, NEVER invents structured values, and NEVER submits the registration —
 * that is decided by deterministic validation + explicit user confirmation.
 */

import { OpenRouterService } from "./openrouter";
import {
  FIELD_IDS,
  isRegisteredFieldId,
  type RegistrationFormState,
  type RegistrationLanguage,
} from "../../lib/registrationSchema";
import {
  deterministicExtract,
  type ProposedUpdate,
} from "../../lib/registrationNormalization";
import { FIELD_QUESTIONS } from "../../lib/registrationVoice";

export interface ExtractionResult {
  updates: ProposedUpdate[];
  /** true when the OpenRouter model produced usable output. */
  usedModel: boolean;
  /** present when the model was unavailable/failed (deterministic fallback used). */
  modelError?: string;
}

/** Whitelisted fields the model is allowed to propose (never arbitrary keys). */
const MODEL_ALLOWED_FIELDS = FIELD_IDS.filter((id) => id !== "latitude" && id !== "longitude");

function buildSystemPrompt(language: RegistrationLanguage): string {
  const langName = language === "kn-IN" ? "Kannada" : language === "hi-IN" ? "Hindi" : "English";
  const fieldSpec = MODEL_ALLOWED_FIELDS.map((id) => {
    const question = FIELD_QUESTIONS[id]?.[language] || id;
    return `"${id}" (answer to: ${question})`;
  }).join(",\n    ");

  return `You are a form-filling assistant for an Indian agri-business registration form.
The user answered a question in ${langName}. Extract EVERY clearly-supported registration field from the answer.

Allowed field keys (use ONLY these exact keys — never invent keys or values):
    ${fieldSpec}

Rules:
- Return ONLY valid JSON, no prose.
- Format: {"updates": [{"fieldId": "<key>", "value": <value>}]}
- For "selectedCrops" the value is an array of canonical English crop names (e.g. "Tomato", "Onion").
- For "category" use one of: local_vendor, wholesaler, retailer, distributor, processor, exporter, cooperative, fpo, bulk_purchaser.
- For "transportPreference" use pickup, delivery or both. For "serviceCoverage" use village, taluk, district, multiple_districts or statewide.
- For "consentToPublish" use true/false.
- Do NOT guess a phone number, email, address, coordinates, quantity or category that the user did not clearly state.
- If a value is unclear, omit it. If nothing is extractable, return {"updates": []}.
- Never include a "confirm", "submit", or any key outside the allowed list.`;
}

export class RegistrationExtractionService {
  static async extract(input: {
    transcript: string;
    language: RegistrationLanguage;
    currentFieldId: string | null;
    formState: RegistrationFormState;
  }): Promise<ExtractionResult> {
    const { transcript, language, formState } = input;

    // Deterministic pass always runs — it is code-controlled and trustworthy.
    const deterministic = deterministicExtract(transcript, language, formState);

    let modelUpdates: ProposedUpdate[] = [];
    let usedModel = false;
    let modelError: string | undefined;

    try {
      const messages = [
        { role: "system" as const, content: buildSystemPrompt(language) },
        { role: "user" as const, content: transcript },
      ];
      const res = await OpenRouterService.chat(messages);
      const content = res.choices?.[0]?.message?.content || "";
      modelUpdates = parseModelUpdates(content);
      usedModel = modelUpdates.length > 0;
    } catch (err) {
      // Model unavailable — retain deterministic results; do NOT switch models.
      modelError = err instanceof Error ? err.message : "OpenRouter unavailable";
    }

    // Merge: deterministic wins over model for the same field (more trustworthy),
    // then de-dupe by fieldId keeping the deterministic value.
    const merged = mergeUpdates(deterministic, modelUpdates);
    return { updates: merged, usedModel, modelError };
  }
}

/** Parse the model JSON defensively and enforce the field whitelist. */
export function parseModelUpdates(content: string): ProposedUpdate[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  const candidate = parsed as { updates?: unknown } | unknown[] | null;
  const raw: unknown[] = Array.isArray(candidate)
    ? candidate
    : candidate && typeof candidate === "object" && Array.isArray((candidate as { updates?: unknown }).updates)
    ? (candidate as { updates: unknown[] }).updates
    : [];
  const out: ProposedUpdate[] = [];
  for (const item of raw) {
    const entry = item as { fieldId?: unknown; value?: unknown } | null;
    const fieldId = typeof entry?.fieldId === "string" ? entry.fieldId : undefined;
    if (!fieldId || !isRegisteredFieldId(fieldId)) continue; // reject arbitrary / non-whitelisted keys
    if (fieldId === "latitude" || fieldId === "longitude") continue; // coordinates never from model
    if (entry?.value === undefined || entry?.value === null) continue;
    out.push({ fieldId, value: entry.value });
  }
  return out;
}

function mergeUpdates(primary: ProposedUpdate[], secondary: ProposedUpdate[]): ProposedUpdate[] {
  const seen = new Set<string>();
  const merged: ProposedUpdate[] = [];
  for (const u of [...primary, ...secondary]) {
    if (seen.has(u.fieldId)) continue;
    seen.add(u.fieldId);
    merged.push(u);
  }
  return merged;
}
