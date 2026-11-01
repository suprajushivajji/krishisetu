/**
 * Single source of truth for the 3-step business registration form.
 *
 * Shared by:
 * - BusinessRegistrationModal (manual entry)
 * - VoiceRegistrationModal (voice-driven filling)
 * - Server-side voice registration extraction/validation routes
 *
 * The form state here maps 1:1 to the payload accepted by POST /api/v1/businesses.
 */

export type RegistrationLanguage = "en-IN" | "hi-IN" | "kn-IN";

export const CATEGORIES = [
  { id: "local_vendor", label: "Local Vendor / Mandi Agent" },
  { id: "wholesaler", label: "Wholesale Trader" },
  { id: "retailer", label: "Retail Chain / Supermarket" },
  { id: "distributor", label: "Distributor" },
  { id: "processor", label: "Food Processing Plant" },
  { id: "exporter", label: "Agri Exporter" },
  { id: "cooperative", label: "Farmers Cooperative / Society" },
  { id: "fpo", label: "Farmer Producer Organization (FPO)" },
  { id: "bulk_purchaser", label: "Bulk Institution / HoReCa" },
];

export const CROPS_LIST = [
  "Tomato",
  "Onion",
  "Potato",
  "Green Chilli",
  "Maize",
  "Ragi",
  "Cotton",
  "Turmeric",
  "Ginger",
  "Arecanut",
  "Coconut",
  "Banana",
];

export const DISTRICTS_KARNATAKA = [
  "Davanagere",
  "Harihar",
  "Dharwad",
  "Hubballi",
  "Belagavi",
  "Kolar",
  "Chitradurga",
  "Shivamogga",
  "Haveri",
  "Bellary",
  "Mandya",
  "Mysuru",
  "Tumakuru",
  "Bengaluru Rural",
];

export const TRANSPORT_OPTIONS = ["pickup", "delivery", "both"] as const;
export type TransportPreference = (typeof TRANSPORT_OPTIONS)[number];

export const COVERAGE_OPTIONS = ["village", "taluk", "district", "multiple_districts", "statewide"] as const;
export type ServiceCoverage = (typeof COVERAGE_OPTIONS)[number];

/** Exact form state shape used by BusinessRegistrationModal and the voice agent. */
export interface RegistrationFormState {
  businessName: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  locality: string;
  taluk: string;
  district: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  selectedCrops: string[];
  minQuantityKg: number;
  maxQuantityKg: number;
  transportPreference: TransportPreference;
  serviceCoverage: ServiceCoverage;
  paymentTerms: string;
  description: string;
  consentToPublish: boolean;
}

/** Defaults identical to the original manual form so nothing changes for manual users. */
export const initialRegistrationState: RegistrationFormState = {
  businessName: "",
  category: "wholesaler",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  locality: "",
  taluk: "",
  district: "Davanagere",
  state: "Karnataka",
  pincode: "577002",
  latitude: 14.4644,
  longitude: 75.9218,
  selectedCrops: ["Tomato"],
  minQuantityKg: 100,
  maxQuantityKg: 5000,
  transportPreference: "pickup",
  serviceCoverage: "district",
  paymentTerms: "Immediate Cash/UPI upon pickup",
  description: "",
  consentToPublish: true,
};

export type FieldErrorCode =
  | "REQUIRED"
  | "INVALID_PHONE"
  | "INVALID_EMAIL"
  | "INVALID_CATEGORY"
  | "INVALID_CROP"
  | "INVALID_DISTRICT"
  | "INVALID_COORDINATES"
  | "INVALID_QUANTITY"
  | "INVALID_TRANSPORT"
  | "INVALID_COVERAGE"
  | "INVALID_PINCODE"
  | "INVALID_URL";

export type FieldValueType = "text" | "enum" | "number" | "stringArray" | "boolean" | "coordinate";

interface FieldDefinition {
  id: keyof RegistrationFormState;
  step: 1 | 2 | 3;
  required: boolean;
  type: FieldValueType;
  /** Skip (null) is acceptable even when the field is required (e.g. optional email). */
  skippable: boolean;
  /** Fields the voice agent asks, in this order within the step. */
  askedByVoice: boolean;
}

export const REGISTRY_ORDER: Record<1 | 2 | 3, string[]> = {
  1: ["businessName", "category", "contactPerson", "phone", "email"],
  2: ["address", "district", "taluk", "locality", "pincode", "latitude", "longitude", "serviceCoverage"],
  3: ["selectedCrops", "minQuantityKg", "maxQuantityKg", "transportPreference", "paymentTerms", "description", "consentToPublish"],
};

export const FIELD_DEFINITIONS: Record<string, FieldDefinition> = {
  businessName: { id: "businessName", step: 1, required: true, type: "text", skippable: false, askedByVoice: true },
  category: { id: "category", step: 1, required: true, type: "enum", skippable: false, askedByVoice: true },
  contactPerson: { id: "contactPerson", step: 1, required: true, type: "text", skippable: false, askedByVoice: true },
  phone: { id: "phone", step: 1, required: true, type: "text", skippable: false, askedByVoice: true },
  email: { id: "email", step: 1, required: false, type: "text", skippable: true, askedByVoice: true },
  address: { id: "address", step: 2, required: true, type: "text", skippable: false, askedByVoice: true },
  district: { id: "district", step: 2, required: true, type: "enum", skippable: false, askedByVoice: true },
  taluk: { id: "taluk", step: 2, required: false, type: "text", skippable: true, askedByVoice: true },
  locality: { id: "locality", step: 2, required: false, type: "text", skippable: true, askedByVoice: true },
  pincode: { id: "pincode", step: 2, required: false, type: "text", skippable: true, askedByVoice: true },
  latitude: { id: "latitude", step: 2, required: true, type: "coordinate", skippable: false, askedByVoice: true },
  longitude: { id: "longitude", step: 2, required: true, type: "coordinate", skippable: false, askedByVoice: true },
  serviceCoverage: { id: "serviceCoverage", step: 2, required: false, type: "enum", skippable: false, askedByVoice: true },
  selectedCrops: { id: "selectedCrops", step: 3, required: true, type: "stringArray", skippable: false, askedByVoice: true },
  minQuantityKg: { id: "minQuantityKg", step: 3, required: false, type: "number", skippable: false, askedByVoice: true },
  maxQuantityKg: { id: "maxQuantityKg", step: 3, required: false, type: "number", skippable: false, askedByVoice: true },
  transportPreference: { id: "transportPreference", step: 3, required: false, type: "enum", skippable: false, askedByVoice: true },
  paymentTerms: { id: "paymentTerms", step: 3, required: false, type: "text", skippable: true, askedByVoice: true },
  description: { id: "description", step: 3, required: false, type: "text", skippable: true, askedByVoice: true },
  consentToPublish: { id: "consentToPublish", step: 3, required: false, type: "boolean", skippable: false, askedByVoice: true },
};

export const FIELD_IDS = Object.keys(FIELD_DEFINITIONS);

/** Whitelist guard: model output may never mutate arbitrary form state keys. */
export function isRegisteredFieldId(fieldId: string): fieldId is keyof RegistrationFormState {
  return Object.prototype.hasOwnProperty.call(FIELD_DEFINITIONS, fieldId);
}

// ---------------------------------------------------------------------------
// Deterministic validation (mirrors POST /api/v1/businesses zod schema)
// ---------------------------------------------------------------------------

const PHONE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateField(
  fieldId: keyof RegistrationFormState,
  value: unknown,
  state: RegistrationFormState
): { ok: boolean; code?: FieldErrorCode } {
  const def = FIELD_DEFINITIONS[fieldId];
  if (!def) return { ok: false, code: "REQUIRED" };

  switch (fieldId) {
    case "businessName":
    case "contactPerson": {
      const s = String(value ?? "").trim();
      if (!s) return def.required ? { ok: false, code: "REQUIRED" } : { ok: true };
      return s.length >= 2 ? { ok: true } : { ok: false, code: "REQUIRED" };
    }
    case "phone": {
      const s = String(value ?? "").replace(/[\s-]/g, "");
      if (!s) return { ok: false, code: "REQUIRED" };
      return PHONE_RE.test(s) ? { ok: true } : { ok: false, code: "INVALID_PHONE" };
    }
    case "email": {
      const s = String(value ?? "").trim();
      if (!s) return { ok: true }; // optional
      return EMAIL_RE.test(s) ? { ok: true } : { ok: false, code: "INVALID_EMAIL" };
    }
    case "category": {
      const s = String(value ?? "");
      return CATEGORIES.some((c) => c.id === s) ? { ok: true } : { ok: false, code: "INVALID_CATEGORY" };
    }
    case "address": {
      const s = String(value ?? "").trim();
      if (!s) return { ok: false, code: "REQUIRED" };
      return s.length >= 5 ? { ok: true } : { ok: false, code: "REQUIRED" };
    }
    case "district": {
      const s = String(value ?? "").trim();
      return DISTRICTS_KARNATAKA.some((d) => d.toLowerCase() === s.toLowerCase())
        ? { ok: true }
        : { ok: false, code: "INVALID_DISTRICT" };
    }
    case "state": {
      return String(value ?? "").trim().length >= 2 ? { ok: true } : { ok: false, code: "REQUIRED" };
    }
    case "taluk":
    case "locality": {
      return { ok: true }; // optional free text
    }
    case "pincode": {
      const s = String(value ?? "").trim();
      if (!s) return { ok: true }; // optional
      return /^\d{6}$/.test(s) ? { ok: true } : { ok: false, code: "INVALID_PINCODE" };
    }
    case "latitude": {
      const n = Number(value);
      if (!Number.isFinite(n) || n < -90 || n > 90) return { ok: false, code: "INVALID_COORDINATES" };
      return { ok: true };
    }
    case "longitude": {
      const n = Number(value);
      if (!Number.isFinite(n) || n < -180 || n > 180) return { ok: false, code: "INVALID_COORDINATES" };
      return { ok: true };
    }
    case "selectedCrops": {
      const arr = Array.isArray(value) ? value : [];
      if (arr.length === 0) return { ok: false, code: "INVALID_CROP" };
      const known = new Set(CROPS_LIST.map((c) => c.toLowerCase()));
      return arr.every((c) => typeof c === "string" && known.has(c.toLowerCase()))
        ? { ok: true }
        : { ok: false, code: "INVALID_CROP" };
    }
    case "minQuantityKg":
    case "maxQuantityKg": {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return { ok: false, code: "INVALID_QUANTITY" };
      if (state.minQuantityKg > 0 && state.maxQuantityKg > 0 && fieldId === "maxQuantityKg" && n < state.minQuantityKg) {
        return { ok: false, code: "INVALID_QUANTITY" };
      }
      if (fieldId === "minQuantityKg" && state.maxQuantityKg > 0 && n > state.maxQuantityKg) {
        return { ok: false, code: "INVALID_QUANTITY" };
      }
      return { ok: true };
    }
    case "transportPreference": {
      const s = String(value ?? "");
      return (TRANSPORT_OPTIONS as readonly string[]).includes(s) ? { ok: true } : { ok: false, code: "INVALID_TRANSPORT" };
    }
    case "serviceCoverage": {
      const s = String(value ?? "");
      return (COVERAGE_OPTIONS as readonly string[]).includes(s) ? { ok: true } : { ok: false, code: "INVALID_COVERAGE" };
    }
    case "paymentTerms": {
      return String(value ?? "").trim().length >= 3 ? { ok: true } : { ok: false, code: "REQUIRED" };
    }
    case "description": {
      return { ok: true }; // optional free text
    }
    case "consentToPublish": {
      return typeof value === "boolean" ? { ok: true } : { ok: false, code: "REQUIRED" };
    }
    default:
      return { ok: false, code: "REQUIRED" };
  }
}

/**
 * Apply a validated value to the form state. Returns a NEW state (never mutates).
 * Rejects unknown field ids so model output cannot mutate arbitrary keys.
 */
export function applyFieldUpdate(
  state: RegistrationFormState,
  fieldId: string,
  value: unknown
): { state: RegistrationFormState } | { error: string } {
  if (!isRegisteredFieldId(fieldId)) return { error: `Unknown field '${fieldId}'` };
  const validation = validateField(fieldId, value, state);
  if (!validation.ok) return { error: validation.code || "INVALID" };
  return { state: { ...state, [fieldId]: value } as RegistrationFormState };
}

// ---------------------------------------------------------------------------
// Step completion — same rules as the manual "Continue" buttons
// ---------------------------------------------------------------------------

/** Manual Step 1 gate: disabled={!businessName || !contactPerson || !phone} */
export function isStep1Complete(state: RegistrationFormState): boolean {
  return (
    Boolean(state.businessName.trim()) &&
    Boolean(state.contactPerson.trim()) &&
    validateField("phone", state.phone, state).ok &&
    validateField("category", state.category, state).ok
  );
}

/** Manual Step 2 gate: disabled={!address} plus strict validation of filled values. */
export function isStep2Complete(state: RegistrationFormState): boolean {
  return (
    validateField("address", state.address, state).ok &&
    validateField("district", state.district, state).ok &&
    validateField("latitude", state.latitude, state).ok &&
    validateField("longitude", state.longitude, state).ok &&
    validateField("serviceCoverage", state.serviceCoverage, state).ok &&
    validateField("pincode", state.pincode, state).ok
  );
}

/** Manual Submit gate: disabled when selectedCrops is empty. */
export function isStep3Complete(state: RegistrationFormState): boolean {
  return (
    validateField("selectedCrops", state.selectedCrops, state).ok &&
    validateField("minQuantityKg", state.minQuantityKg, state).ok &&
    validateField("maxQuantityKg", state.maxQuantityKg, state).ok &&
    validateField("transportPreference", state.transportPreference, state).ok
  );
}

export function isStepComplete(step: 1 | 2 | 3, state: RegistrationFormState): boolean {
  if (step === 1) return isStep1Complete(state);
  if (step === 2) return isStep2Complete(state);
  return isStep3Complete(state);
}

/** Full-form re-validation before submission. Returns localized-key error list. */
export function validateForm(state: RegistrationFormState): { fieldId: keyof RegistrationFormState; code: FieldErrorCode }[] {
  const errors: { fieldId: keyof RegistrationFormState; code: FieldErrorCode }[] = [];
  for (const id of FIELD_IDS as (keyof RegistrationFormState)[]) {
    const res = validateField(id, state[id] as unknown, state);
    if (!res.ok && res.code) errors.push({ fieldId: id, code: res.code });
  }
  return errors;
}

/** Build the exact POST /api/v1/businesses payload from form state (same contract as manual submit). */
export function buildBusinessPayload(state: RegistrationFormState, isDraft = false) {
  return {
    businessName: state.businessName,
    category: state.category,
    contactPerson: state.contactPerson,
    phone: state.phone,
    email: state.email,
    address: state.address,
    locality: state.locality,
    taluk: state.taluk,
    district: state.district,
    state: state.state,
    pincode: state.pincode,
    latitude: state.latitude,
    longitude: state.longitude,
    cropsPurchased: state.selectedCrops,
    minQuantityKg: state.minQuantityKg,
    maxQuantityKg: state.maxQuantityKg,
    preferredUnit: "kg",
    procurementFrequency: "daily",
    transportPreference: state.transportPreference,
    serviceCoverage: state.serviceCoverage,
    serviceDistricts: [state.district],
    paymentMethods: ["Cash", "UPI"],
    paymentTerms: state.paymentTerms,
    description: state.description,
    consentToPublish: state.consentToPublish,
    isDraft,
  };
}
