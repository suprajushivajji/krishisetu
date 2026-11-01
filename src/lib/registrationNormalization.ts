/**
 * Deterministic value normalization + fallback extraction for the
 * voice-driven business registration flow.
 *
 * Everything here is pure and code-controlled: the LLM may PROPOSE values,
 * but only these normalizers/validators decide what reaches the form.
 * Shared by the server extraction service and the client state machine.
 */

import {
  CROPS_LIST,
  DISTRICTS_KARNATAKA,
  type RegistrationFormState,
  type RegistrationLanguage,
} from "./registrationSchema";
import {
  CATEGORY_ALIASES,
  COVERAGE_ALIASES,
  CROP_ALIASES,
  DISTRICT_ALIASES,
  SPOKEN_DIGITS,
  SPOKEN_SCALES,
  SKIP_WORDS,
  TRANSPORT_ALIASES,
  YES_WORDS,
  NO_WORDS,
} from "./registrationVoice";

export interface ProposedUpdate {
  fieldId: string;
  value: unknown;
  /** true when the answer explicitly skips an optional field. */
  skip?: boolean;
}

// ---------------------------------------------------------------------------
// Spoken digit / number normalization
// ---------------------------------------------------------------------------

/** Convert a string containing spoken digit words (en/kn/hi) to digits. */
export function normalizeSpokenDigits(input: string): string {
  const tokens = input.toLowerCase().split(/(\s+|-|,|।)/).filter((t) => t && t.trim() !== "");
  let out = "";
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) {
      out += raw;
      continue;
    }
    if (/^\d+$/.test(token)) {
      out += token;
      continue;
    }
    if (SPOKEN_DIGITS[token] !== undefined) {
      out += SPOKEN_DIGITS[token];
      continue;
    }
    out += ` ${token} `;
  }
  return out;
}

/** Extract a phone number from a transcript; returns "" when none found. */
export function extractPhone(text: string): string {
  const digitized = normalizeSpokenDigits(text).replace(/[^0-9]/g, " ");
  const runs = digitized.split(/\s+/).filter(Boolean);
  // Prefer a run of exactly 10 starting with 6-9; also accept 12 (91-prefixed).
  for (const run of runs) {
    if (run.length === 12 && (run.startsWith("91") || run.startsWith("091"))) {
      const ten = run.replace(/^0?91/, "");
      if (/^[6-9]\d{9}$/.test(ten)) return ten;
    }
  }
  for (const run of runs) {
    if (run.length === 10 && /^[6-9]\d{9}$/.test(run)) return run;
  }
  for (const run of runs) {
    if (run.length > 10) {
      const tail = run.slice(-10);
      if (/^[6-9]\d{9}$/.test(tail)) return tail;
    }
  }
  return "";
}

/** Parse a spoken/typed quantity (digits, digit-words and scale words) to a number. */
export function normalizeQuantity(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw ?? "").toLowerCase().trim();
  if (!text) return null;

  const direct = text.match(/(\d+(?:\.\d+)?)/);
  if (direct && !/[a-zಀ-೿ऀ-ह]/i.test(text.replace(direct[0], "").trim())) {
    // Only a number (plus optional unit words like "kg") — trust it.
    const digitized = normalizeSpokenDigits(text);
    const m = digitized.match(/(\d+(?:\.\d+)?)/);
    if (m) return Number(m[1]);
  }

  // Word-form number: collect digit and scale tokens in order.
  const digitized = normalizeSpokenDigits(text);
  const tokens = digitized.split(/[\s,]+/);
  let total = 0;
  let current = 0;
  let sawNumber = false;
  for (const t of tokens) {
    if (/^\d+(\.\d+)?$/.test(t)) {
      current += Number(t);
      sawNumber = true;
    } else if (SPOKEN_SCALES[t] !== undefined) {
      const scale = SPOKEN_SCALES[t];
      current = (current === 0 ? 1 : current) * scale;
      if (scale >= 1000) {
        total += current;
        current = 0;
      }
      sawNumber = true;
    }
  }
  const value = total + current;
  return sawNumber && value > 0 ? value : null;
}

// ---------------------------------------------------------------------------
// Alias-based deterministic matching
// ---------------------------------------------------------------------------

function containsAlias(text: string, aliases: string[]): boolean {
  return aliases.some((a) => text.includes(a));
}

export function matchCategory(text: string): string | null {
  const lower = text.toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const [id, aliases] of Object.entries(CATEGORY_ALIASES)) {
    for (const a of aliases) {
      if (lower.includes(a) && (!best || a.length > best.len)) best = { id, len: a.length };
    }
  }
  return best ? best.id : null;
}

export function matchCrops(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const crop of CROPS_LIST) {
    const aliases = CROP_ALIASES[crop] || [crop.toLowerCase()];
    if (containsAlias(lower, aliases) && !matched.includes(crop)) matched.push(crop);
  }
  return matched;
}

export function matchDistrict(text: string): string | null {
  const lower = text.toLowerCase();
  let best: { name: string; len: number } | null = null;
  for (const d of DISTRICTS_KARNATAKA) {
    const aliases = DISTRICT_ALIASES[d] || [d.toLowerCase()];
    for (const a of aliases) {
      if (a && lower.includes(a) && (!best || a.length > best.len)) best = { name: d, len: a.length };
    }
  }
  return best ? best.name : null;
}

export function matchTransport(text: string): string | null {
  const lower = text.toLowerCase();
  if (containsAlias(lower, TRANSPORT_ALIASES.both)) return "both";
  if (containsAlias(lower, TRANSPORT_ALIASES.pickup)) return "pickup";
  if (containsAlias(lower, TRANSPORT_ALIASES.delivery)) return "delivery";
  return null;
}

export function matchCoverage(text: string): string | null {
  const lower = text.toLowerCase();
  const ordered = ["statewide", "multiple_districts", "district", "taluk", "village"];
  for (const key of ordered) {
    if (containsAlias(lower, COVERAGE_ALIASES[key])) return key;
  }
  return null;
}

export function isSkipAnswer(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  return SKIP_WORDS.some((w) => lower === w || lower.includes(w));
}

export function matchBoolean(text: string): boolean | null {
  const lower = text.toLowerCase().trim();
  if (YES_WORDS.some((w) => lower === w || lower.startsWith(w))) return true;
  if (NO_WORDS.some((w) => lower === w || lower.startsWith(w))) return false;
  return null;
}

export function extractEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

/** Extract a 6-digit PIN code (digits or spoken digit words). */
export function extractPincode(text: string): string | null {
  const digitized = normalizeSpokenDigits(text);
  const runs = digitized.split(/[^0-9]+/).filter(Boolean);
  const six = runs.find((r) => r.length === 6);
  return six || null;
}

/** Extract a min/max quantity pair from a range statement in any supported language. */
export function extractQuantityRange(text: string): { min: number; max: number } | null {
  const digitized = normalizeSpokenDigits(text.toLowerCase());
  // Numeric range patterns: "100 to 5000", "100 - 5000", "100 to 5,000 kg"
  let m = digitized.match(/(\d+)\s*(?:to|–|-|–|ರಿಂದ|から|से|تق)\s*(\d+)/);
  if (!m) {
    // Spoken "from X kg to Y kg"
    m = digitized.match(/(?:from|ಹಿಂದ)?\s*(\d+)\s*(?:kg|kilo|quintal|ಕ್ರಮ)?\s*(?:to|ಗೂ|से)\s*(\d+)/);
  }
  if (m) {
    const min = Number(m[1]);
    const max = Number(m[2]);
    if (min > 0 && max >= min) return { min, max };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field-level normalization: propose -> canonical value (or null)
// ---------------------------------------------------------------------------

/**
 * Normalize a proposed raw value for a field into the canonical form used by
 * the form state. Deterministic; returns null when nothing usable was found.
 */
export function normalizeFieldValue(fieldId: string, rawValue: unknown, _state: RegistrationFormState): unknown | null {
  const asText = typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
  switch (fieldId) {
    case "phone": {
      const cleaned = asText.replace(/[\s-+()]/g, "");
      if (/^[6-9]\d{9}$/.test(cleaned)) return cleaned;
      if (/^0?[6-9]\d{9}$/.test(cleaned)) return cleaned.replace(/^0/, "");
      if (/^91[6-9]\d{9}$/.test(cleaned)) return cleaned.slice(2);
      const fromSpeech = extractPhone(asText);
      return fromSpeech || null;
    }
    case "email": {
      const direct = asText.trim();
      if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(direct)) return direct.toLowerCase();
      return extractEmail(asText);
    }
    case "category": {
      const direct = asText.trim().toLowerCase().replace(/\s+/g, "_");
      const known = ["local_vendor", "wholesaler", "retailer", "distributor", "processor", "exporter", "cooperative", "fpo", "bulk_purchaser"];
      if (known.includes(direct)) return direct;
      return matchCategory(asText);
    }
    case "district": {
      const exact = DISTRICTS_KARNATAKA.find((d) => d.toLowerCase() === asText.trim().toLowerCase());
      if (exact) return exact;
      return matchDistrict(asText);
    }
    case "selectedCrops": {
      if (Array.isArray(rawValue)) {
        const known = new Map(CROPS_LIST.map((c) => [c.toLowerCase(), c]));
        const mapped = rawValue.map((v) => known.get(String(v).toLowerCase())).filter(Boolean);
        return mapped.length === rawValue.length && mapped.length > 0 ? mapped : null;
      }
      const crops = matchCrops(asText);
      return crops.length > 0 ? crops : null;
    }
    case "minQuantityKg":
    case "maxQuantityKg": {
      const n = normalizeQuantity(rawValue);
      return n !== null && n > 0 ? n : null;
    }
    case "transportPreference": {
      const direct = asText.trim().toLowerCase();
      if (["pickup", "delivery", "both"].includes(direct)) return direct;
      return matchTransport(asText);
    }
    case "serviceCoverage": {
      const direct = asText.trim().toLowerCase();
      if (["village", "taluk", "district", "multiple_districts", "statewide"].includes(direct)) return direct;
      return matchCoverage(asText);
    }
    case "pincode": {
      const digits = asText.replace(/\D/g, "");
      if (/^\d{6}$/.test(digits)) return digits;
      return extractPincode(asText);
    }
    case "latitude":
    case "longitude": {
      const n = Number(rawValue);
      if (Number.isFinite(n)) return n;
      // "use district coordinates" style confirmation — never invent numbers.
      return null;
    }
    case "consentToPublish": {
      if (typeof rawValue === "boolean") return rawValue;
      return matchBoolean(asText);
    }
    case "businessName":
    case "contactPerson":
    case "address":
    case "taluk":
    case "locality":
    case "state":
    case "paymentTerms":
    case "description": {
      const cleaned = extractTextAnswer(fieldId, asText);
      return cleaned.length > 0 ? cleaned : null;
    }
    default:
      return null;
  }
}

/**
 * Extract the answer portion from a spoken/typed response to a free-text
 * question. This prevents phrases such as "contact person's name is Supraj"
 * from being stored as the contact person's name.
 */
export function extractTextAnswer(fieldId: string, transcript: string): string {
  const text = transcript.trim().replace(/\s+/g, " ");
  if (!text) return "";

  const labels: Record<string, string> = {
    businessName: "business\\s+name",
    contactPerson: "contact\\s+person(?:'s)?(?:\\s+name)?|contact\\s+name",
    address: "business\\s+address|address",
    taluk: "taluk|taluka",
    locality: "locality|yard",
    paymentTerms: "payment\\s+terms?",
    description: "description|business\\s+description",
  };
  const label = labels[fieldId];
  if (!label) return text;

  const matches = [...text.matchAll(new RegExp(
    `(?:^|\\s)(?:(?:the|my|your)\\s+)?(?:${label})\\s*(?:is|are|:|-)?\\s+(.+?)(?=\\s+(?:(?:the|my|your)\\s+)?(?:${label})\\s*(?:is|are|:|-)?\\s+|$)`,
    "gi"
  ))];
  return (matches.at(-1)?.[1] || text).trim();
}

/**
 * Deterministic fallback extraction used when the LLM is unavailable or to
 * supplement model output. Only recognises structured fields (phone, email,
 * category, crops, district, quantities, transport, coverage, pincode,
 * booleans) — free-text values like business names are NEVER guessed here.
 */
export function deterministicExtract(transcript: string, _language: RegistrationLanguage, _state: RegistrationFormState): ProposedUpdate[] {
  const updates: ProposedUpdate[] = [];
  const text = transcript.trim();
  if (!text) return updates;

  if (isSkipAnswer(text)) {
    // A bare skip only applies to the currently asked field (handled by caller).
    return updates;
  }

  const phone = extractPhone(text);
  if (phone) updates.push({ fieldId: "phone", value: phone });

  const email = extractEmail(text);
  if (email) updates.push({ fieldId: "email", value: email });

  const category = matchCategory(text);
  if (category) updates.push({ fieldId: "category", value: category });

  const crops = matchCrops(text);
  if (crops.length > 0) updates.push({ fieldId: "selectedCrops", value: crops });

  const district = matchDistrict(text);
  if (district) updates.push({ fieldId: "district", value: district });

  const range = extractQuantityRange(text);
  if (range) {
    updates.push({ fieldId: "minQuantityKg", value: range.min });
    updates.push({ fieldId: "maxQuantityKg", value: range.max });
  }

  const transport = matchTransport(text);
  if (transport) updates.push({ fieldId: "transportPreference", value: transport });

  const coverage = matchCoverage(text);
  if (coverage) updates.push({ fieldId: "serviceCoverage", value: coverage });

  const pincode = extractPincode(text);
  if (pincode && !phone) updates.push({ fieldId: "pincode", value: pincode });

  return updates;
}
