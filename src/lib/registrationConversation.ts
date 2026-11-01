/**
 * Deterministic conversation state machine for voice-driven business
 * registration. Pure TypeScript — no React, no network — so it is fully
 * unit-testable and identical in tests and UI.
 *
 * States:
 * idle → asking → recording → transcribing → extracting → validating →
 * filling → asking_next → review → confirming → submitting → completed
 * plus: failed, retry, cancelled and correction flows.
 *
 * The machine owns the ACTUAL RegistrationFormState: every accepted update is
 * applied through applyFieldUpdate (whitelist + deterministic validation), so
 * extracted values populate the real form, not a side copy.
 */

import {
  FIELD_DEFINITIONS,
  REGISTRY_ORDER,
  applyFieldUpdate,
  isRegisteredFieldId,
  isStepComplete,
  validateField,
  validateForm,
  type FieldErrorCode,
  type RegistrationFormState,
  type RegistrationLanguage,
} from "./registrationSchema";
import { normalizeFieldValue, isSkipAnswer, matchBoolean, type ProposedUpdate } from "./registrationNormalization";
import { CONFIRM_WORDS, FIELD_QUESTIONS, FIELD_LABELS, UI_STRINGS, VALIDATION_MESSAGES, categoryLabel } from "./registrationVoice";

export type MachineStatus =
  | "idle"
  | "language_selected"
  | "asking"
  | "recording"
  | "transcribing"
  | "extracting"
  | "validating"
  | "filling"
  | "asking_next"
  | "review"
  | "confirming"
  | "submitting"
  | "completed"
  | "failed"
  | "cancelled";

/** Fields handled by deterministic GPS confirmation instead of free speech. */
const COORD_FIELD = "latitude"; // longitude is filled together with latitude

export interface FilledFieldInfo {
  fieldId: string;
  source: "voice" | "typed" | "manual" | "default";
  valueLabel: string;
}

export interface AnswerResult {
  filled: string[];
  errors: { fieldId: string; code: FieldErrorCode | "UNCLEAR" }[];
  nextQuestion: string | null;
  nextFieldId: string | null;
  advancedToStep: 1 | 2 | 3 | null;
  status: MachineStatus;
}

export interface MachineResult {
  ok: boolean;
  error?: string;
}

export class RegistrationConversationMachine {
  status: MachineStatus = "idle";
  language: RegistrationLanguage | null = null;
  formState: RegistrationFormState;
  currentStep: 1 | 2 | 3 = 1;
  currentFieldId: string | null = null;
  private _prevStep: 1 | 2 | 3 = 1;
  /** Questions already answered (valid) or explicitly skipped. */
  answered: Set<string> = new Set();
  fillSources: Record<string, FilledFieldInfo["source"]> = {};
  clarifyCount: Record<string, number> = {};
  lastError: { fieldId: string; code: FieldErrorCode | "UNCLEAR" } | null = null;

  constructor(formState: RegistrationFormState) {
    this.formState = { ...formState };
  }

  // ------------------------------------------------------------------ utils
  private assert(can: MachineStatus[]): void {
    if (!can.includes(this.status)) {
      throw new Error(`Illegal transition: cannot move while status is '${this.status}' (allowed from: ${can.join(", ")})`);
    }
  }

  private stepFields(step: 1 | 2 | 3): string[] {
    return REGISTRY_ORDER[step].filter((id) => FIELD_DEFINITIONS[id]?.askedByVoice);
  }

  /** Next required field that is not already valid in the existing form. */
  private nextQuestionOnStep(step: 1 | 2 | 3): string | null {
    for (const id of this.stepFields(step)) {
      if (this.answered.has(id)) continue;
      if (id === "longitude") continue; // handled with latitude
      const def = FIELD_DEFINITIONS[id];
      if (!def || !def.required) continue;
      if (validateField(id as keyof RegistrationFormState, this.formState[id as keyof RegistrationFormState], this.formState).ok) {
        this.answered.add(id);
        if (id === COORD_FIELD) this.answered.add("longitude");
        continue;
      }
      return id;
    }
    return null;
  }

  /** Walk steps 1..3 to find the next outstanding question overall. */
  private nextOutstandingField(): { fieldId: string; step: 1 | 2 | 3 } | null {
    for (const step of [1, 2, 3] as const) {
      const id = this.nextQuestionOnStep(step);
      if (id) return { fieldId: id, step };
    }
    return null;
  }

  // -------------------------------------------------------------- lifecycle
  selectLanguage(language: RegistrationLanguage): void {
    this.language = language;
    this.status = "language_selected";
  }

  /** Begin (or resume) the interview. Speaks the first outstanding question. */
  start(): void {
    this.assert(["language_selected", "asking", "asking_next", "failed", "review"]);
    const next = this.nextOutstandingField();
    if (!next) {
      this.status = "review";
      return;
    }
    this.currentStep = next.step;
    this.currentFieldId = next.fieldId;
    this.status = "asking";
  }

  markRecording(): void {
    this.assert(["asking", "recording", "failed"]);
    this.status = "recording";
  }

  markTranscribing(): void {
    this.assert(["recording", "transcribing"]);
    this.status = "transcribing";
  }

  markExtracting(): void {
    this.assert(["transcribing", "extracting"]);
    this.status = "extracting";
  }

  /** Transcription/服务 failure → retryable state. */
  fail(error: string): void {
    this.lastError = null;
    this.status = "failed";
    this.failMessage = error;
  }
  failMessage: string | null = null;

  /** After a failed step, resume asking the same question. */
  retry(): void {
    this.assert(["failed"]);
    if (this.currentFieldId && !this.answered.has(this.currentFieldId)) {
      this.status = "asking";
    } else {
      this.status = "asking_next";
      this.start();
    }
  }

  cancel(): void {
    this.status = "cancelled";
  }

  // ------------------------------------------------------------ answer path
  /**
   * Process a recognized/typed answer for the current question.
   * `proposed` comes from the LLM and/or deterministic extraction; the machine
   * whitelists fields, normalizes and validates before touching the form.
   */
  processAnswer(transcript: string, proposed: ProposedUpdate[], source: "voice" | "typed"): AnswerResult {
    if (!this.language) throw new Error("Language not selected");
    const askingField = this.currentFieldId;
    if (!askingField) throw new Error("No active question");
    this.assert(["asking", "recording", "transcribing", "extracting", "validating", "failed", "asking_next", "review"]);
    this._prevStep = this.currentStep;
    this.status = "validating";

    const filled: string[] = [];
    const errors: AnswerResult["errors"] = [];

    // 1. Explicit skip handling for the active question.
    const bareSkip = isSkipAnswer(transcript) && proposed.length === 0;
    if (bareSkip) {
      const def = FIELD_DEFINITIONS[askingField];
      if (def?.skippable) {
        this.answered.add(askingField);
        this.fillSources[askingField] = source;
        const next = this.advanceOrReview();
        return this.answerResult(filled, errors, next);
      }
      // Not skippable → re-ask with clarification.
      errors.push({ fieldId: askingField, code: "UNCLEAR" });
      this.recordClarify(askingField);
      return this.answerResult(filled, errors, { fieldId: askingField, step: this.currentStep, reask: true });
    }

    // 2. Special confirmation question for coordinates (never invented).
    if (askingField === COORD_FIELD) {
      const bool = matchBoolean(transcript);
      if (bool === true) {
        // Accept the current district-based defaults already present in state.
        const latOk = validateField("latitude", this.formState.latitude, this.formState).ok;
        const lngOk = validateField("longitude", this.formState.longitude, this.formState).ok;
        if (latOk && lngOk) {
          this.answered.add("latitude");
          this.answered.add("longitude");
          this.fillSources.latitude = source;
          this.fillSources.longitude = source;
          const next = this.advanceOrReview();
          return this.answerResult(["latitude", "longitude"], errors, next);
        }
      }
      if (bool === false || proposed.some((p) => p.fieldId === "latitude" || p.fieldId === "longitude")) {
        errors.push({ fieldId: "latitude", code: "INVALID_COORDINATES" });
        this.recordClarify(askingField);
        return this.answerResult(filled, errors, { fieldId: askingField, step: this.currentStep, reask: true });
      }
      errors.push({ fieldId: askingField, code: "UNCLEAR" });
      this.recordClarify(askingField);
      return this.answerResult(filled, errors, { fieldId: askingField, step: this.currentStep, reask: true });
    }

    // 3. Whitelist + normalize + validate every proposed update.
    this.status = "filling";
    const seenFields = new Set<string>();
    for (const update of proposed) {
      if (!isRegisteredFieldId(update.fieldId)) continue; // reject unknown keys
      if (update.fieldId === "longitude") continue; // filled via latitude
      if (seenFields.has(update.fieldId)) continue;
      seenFields.add(update.fieldId);

      if (update.skip) {
        const def = FIELD_DEFINITIONS[update.fieldId];
        if (def?.skippable) {
          this.answered.add(update.fieldId);
          this.fillSources[update.fieldId] = source;
          filled.push(update.fieldId);
        }
        continue;
      }

      const canonical = normalizeFieldValue(update.fieldId, update.value, this.formState);
      if (canonical === null || canonical === undefined) {
        if (update.fieldId === askingField) {
          errors.push({ fieldId: update.fieldId, code: "UNCLEAR" });
        }
        continue;
      }
      const applied = applyFieldUpdate(this.formState, update.fieldId, canonical);
      if ("error" in applied) {
        if (update.fieldId === askingField) {
          errors.push({ fieldId: update.fieldId, code: (applied.error as FieldErrorCode) || "UNCLEAR" });
        }
        continue; // invalid side-field values are silently dropped
      }
      this.formState = applied.state;
      this.answered.add(update.fieldId);
      if (update.fieldId === "latitude") this.answered.add("longitude");
      this.fillSources[update.fieldId] = source;
      filled.push(update.fieldId);
    }

    // 4. Did we get anything valid for the ACTIVE question?
    const activeFilled = filled.includes(askingField);
    if (!activeFilled) {
      const activeError = errors.find((e) => e.fieldId === askingField);
      if (!activeError) errors.push({ fieldId: askingField, code: "UNCLEAR" });
      this.recordClarify(askingField);
      return this.answerResult(filled, errors, { fieldId: askingField, step: this.currentStep, reask: true });
    }

    const next = this.advanceOrReview();
    return this.answerResult(filled, errors, next);
  }

  /** Edit a previously filled field (correction flow) with a typed value. */
  editField(fieldId: string, rawValue: unknown, source: "typed" | "manual" = "typed"): { ok: boolean; code?: FieldErrorCode | "UNCLEAR" } {
    if (!isRegisteredFieldId(fieldId) || fieldId === "longitude") return { ok: false, code: "UNCLEAR" };
    const canonical = normalizeFieldValue(fieldId, rawValue, this.formState);
    if (canonical === null || canonical === undefined) {
      if (fieldId === "latitude") {
        const bool = matchBoolean(String(rawValue ?? ""));
        if (bool === true) {
          this.answered.add("latitude");
          this.answered.add("longitude");
          return { ok: true };
        }
      }
      return { ok: false, code: "UNCLEAR" };
    }
    const applied = applyFieldUpdate(this.formState, fieldId, canonical);
    if ("error" in applied) return { ok: false, code: (applied.error as FieldErrorCode) || "UNCLEAR" };
    this.formState = applied.state;
    this.answered.add(fieldId);
    if (fieldId === "latitude") this.answered.add("longitude");
    this.fillSources[fieldId] = source;
    return { ok: true };
  }

  /**
   * Sync externally-changed form state (user switched to manual entry and
   * edited fields). Valid values are marked answered; invalid left unfilled.
   */
  syncFormState(next: RegistrationFormState): void {
    this.formState = { ...next };
    for (const id of Object.keys(FIELD_DEFINITIONS)) {
      if (!isRegisteredFieldId(id)) continue;
      if (this.answered.has(id)) continue;
      const value = next[id] as never;
      if (validateField(id, value, next).ok && !this.isDefaultValue(id, value)) {
        this.answered.add(id);
        this.fillSources[id] = "manual";
      }
    }
  }

  private isDefaultValue(id: string, value: unknown): boolean {
    // Defaults from initialRegistrationState that should NOT auto-skip questions.
    const defaults: Record<string, unknown> = {
      category: "wholesaler",
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
      consentToPublish: true,
    };
    const def = defaults[id];
    if (def === undefined) return false;
    if (Array.isArray(def) && Array.isArray(value)) return JSON.stringify(def) === JSON.stringify(value);
    return def === value;
  }

  // ------------------------------------------------------------- navigation
  /**
   * After filling, move to the next outstanding voice question (staying on the
   * current step until all its fields are answered, then advancing steps). A
   * step is only 'done' when its fields hold VALIDATED values — never merely
   * because defaults satisfy it — so the agent still asks every field.
   */
  private advanceOrReview(): { fieldId: string; step: 1 | 2 | 3 } | null {
    let id: string | null = this.nextQuestionOnStep(this.currentStep);
    let step: 1 | 2 | 3 = this.currentStep;
    if (!id) {
      for (const s of [1, 2, 3] as const) {
        const cand = this.nextQuestionOnStep(s);
        if (cand) {
          id = cand;
          step = s;
          break;
        }
      }
    }
    if (id) {
      this.currentStep = step;
      this.currentFieldId = id;
      this.status = "asking";
      return { fieldId: id, step };
    }
    this.currentFieldId = null;
    this.status = "review";
    return null;
  }

  private firstIncompleteFieldOnStep(step: 1 | 2 | 3): string | null {
    for (const id of this.stepFields(step)) {
      if (id === "longitude") continue;
      const value = this.formState[id as keyof RegistrationFormState] as never;
      if (!validateField(id as keyof RegistrationFormState, value, this.formState).ok) return id;
    }
    for (const id of this.stepFields(step)) {
      if (id === "longitude") continue;
      if (!this.answered.has(id)) return id;
    }
    return null;
  }

  /** User returns to a previous step to correct a value. */
  goBackToStep(step: 1 | 2 | 3): MachineResult {
    if (step < 1 || step > 3) return { ok: false, error: "Invalid step" };
    this.currentStep = step;
    const outstanding = this.nextQuestionOnStep(step) || this.firstIncompleteFieldOnStep(step);
    if (outstanding) {
      this.currentFieldId = outstanding;
      this.status = "asking";
    } else {
      // step fully answered — jump to next outstanding overall or review
      const next = this.nextOutstandingField();
      if (next) {
        this.currentStep = next.step;
        this.currentFieldId = next.fieldId;
      } else {
        this.currentFieldId = null;
        this.status = "review";
      }
    }
    return { ok: true };
  }

  /** Ask (re-ask) a specific field — used by "correct a field" flow. */
  askField(fieldId: string): MachineResult {
    if (!isRegisteredFieldId(fieldId) || !FIELD_DEFINITIONS[fieldId]?.askedByVoice) {
      return { ok: false, error: "Unknown field" };
    }
    this.currentStep = FIELD_DEFINITIONS[fieldId].step as 1 | 2 | 3;
    this.currentFieldId = fieldId;
    this.status = "asking";
    return { ok: true };
  }

  // ---------------------------------------------------------------- review
  /** Enter review explicitly (only when all steps valid). */
  goToReview(): MachineResult {
    if (!this.allStepsValid()) return { ok: false, error: "Required fields are still missing" };
    this.currentFieldId = null;
    this.status = "review";
    return { ok: true };
  }

  allStepsValid(): boolean {
    return validateForm(this.formState).length === 0 &&
      isStepComplete(1, this.formState) &&
      isStepComplete(2, this.formState) &&
      isStepComplete(3, this.formState);
  }

  /** Explicit confirmation — UI button or validated voice word. */
  confirm(transcript?: string): MachineResult {
    this.assert(["review"]);
    if (!this.allStepsValid()) return { ok: false, error: "Form has validation errors" };
    if (transcript !== undefined) {
      const lower = transcript.toLowerCase().trim();
      const confirmed = CONFIRM_WORDS.some((w) => lower.includes(w));
      if (!confirmed) return { ok: false, error: "Spoken confirmation not recognised" };
    }
    this.status = "confirming";
    return { ok: true };
  }

  /** Called when the API submission begins (after final re-validation). */
  beginSubmit(): MachineResult {
    this.assert(["confirming"]);
    if (validateForm(this.formState).length > 0) {
      this.status = "review";
      return { ok: false, error: "Final validation failed" };
    }
    this.status = "submitting";
    return { ok: true };
  }

  submitSucceeded(): void {
    this.assert(["submitting"]);
    this.status = "completed";
  }

  submitFailed(): void {
    this.assert(["submitting"]);
    this.status = "review"; // keep data, allow retry
  }

  // ---------------------------------------------------------------- output
  currentQuestion(): string | null {
    if (!this.currentFieldId || !this.language) return null;
    return FIELD_QUESTIONS[this.currentFieldId]?.[this.language] || null;
  }

  clarificationFor(code: FieldErrorCode | "UNCLEAR"): string | null {
    if (!this.language) return null;
    if (code === "UNCLEAR") return UI_STRINGS.modelUnavailable[this.language];
    return VALIDATION_MESSAGES[code]?.[this.language] || VALIDATION_MESSAGES.REQUIRED[this.language];
  }

  private recordClarify(fieldId: string): void {
    this.clarifyCount[fieldId] = (this.clarifyCount[fieldId] || 0) + 1;
    this.status = "asking"; // re-ask same question
  }

  private answerResult(
    filled: string[],
    errors: AnswerResult["errors"],
    next: { fieldId: string; step: 1 | 2 | 3; reask?: boolean } | null
  ): AnswerResult {
    const advanced = next && !next.reask && next.step > this._prevStep ? next.step : null;
    let status = this.status;
    if (status === "asking_next") status = "asking";
    this.lastError = errors[0] || null;
    return {
      filled,
      errors,
      nextQuestion: next ? this.questionFor(next.fieldId) : this.reviewText(),
      nextFieldId: next?.fieldId || null,
      advancedToStep: advanced,
      status,
    };
  }

  questionFor(fieldId: string): string | null {
    if (!this.language) return null;
    return FIELD_QUESTIONS[fieldId]?.[this.language] || null;
  }

  /** Deterministic localized review text built from the ACTUAL form values. */
  reviewText(): string | null {
    if (!this.language) return null;
    return buildReviewText(this.formState, this.language);
  }
}

// ---------------------------------------------------------------------------
// Deterministic localized review read-back (also usable standalone)
// ---------------------------------------------------------------------------

const COVERAGE_LABELS: Record<string, Record<string, string>> = {
  village: { "en-IN": "village", "kn-IN": "ಊರು", "hi-IN": "गाँव" },
  taluk: { "en-IN": "taluk", "kn-IN": "ತಾಲೂಕು", "hi-IN": "तहसील" },
  district: { "en-IN": "whole district", "kn-IN": "ಇಡೀ ಜಿಲ್ಲೆ", "hi-IN": "पूरा जिला" },
  multiple_districts: { "en-IN": "neighbouring districts", "kn-IN": "ಸುತ್ತಮುತ್ತಲ ಜಿಲ್ಲೆಗಳು", "hi-IN": "पड़ोसी जिले" },
  statewide: { "en-IN": "statewide Karnataka", "kn-IN": "ರಾಜ್ಯಮಟ್ಟಿಗೆ", "hi-IN": "पूरे राज्य" },
};

const TRANSPORT_LABELS: Record<string, Record<string, string>> = {
  pickup: { "en-IN": "farm gate pickup", "kn-IN": "ಹೊಲದ ಬಾಗಿಲಿಗೆ ಎತ್ತಿಕೊಳ್ಳುವಿಕೆ", "hi-IN": "फार्म गेट पिकअप" },
  delivery: { "en-IN": "farmer delivery to yard", "kn-IN": "ರೈತರ ಡೆಲಿವರಿ", "hi-IN": "किसान डिलीवरी" },
  both: { "en-IN": "both", "kn-IN": "ಎರಡೂ", "hi-IN": "दोनों" },
};

export function reviewDisplayValue(fieldId: string, state: RegistrationFormState, language: RegistrationLanguage): string {
  const v = state[fieldId as keyof RegistrationFormState];
  switch (fieldId) {
    case "category":
      return categoryLabel(String(v));
    case "selectedCrops":
      return (state.selectedCrops || []).join(", ");
    case "transportPreference":
      return TRANSPORT_LABELS[String(v)]?.[language] || String(v);
    case "serviceCoverage":
      return COVERAGE_LABELS[String(v)]?.[language] || String(v);
    case "minQuantityKg":
    case "maxQuantityKg":
      return `${v} kg`;
    case "consentToPublish": {
      const yesNo: Record<RegistrationLanguage, [string, string]> = {
        "en-IN": ["Yes", "No"],
        "kn-IN": ["ಹೌದು", "ಇಲ್ಲ"],
        "hi-IN": ["हाँ", "नहीं"],
      };
      return v ? yesNo[language][0] : yesNo[language][1];
    }
    case "latitude":
    case "longitude":
      return String(v);
    default:
      return String(v ?? "");
  }
}

export function buildReviewText(state: RegistrationFormState, language: RegistrationLanguage): string {
  const lines: string[] = [];
  const order = [...REGISTRY_ORDER[1], ...REGISTRY_ORDER[2], ...REGISTRY_ORDER[3]];
  for (const id of order) {
    if (id === "longitude") continue;
    if (id === "latitude") {
      lines.push(`${FIELD_LABELS.latitude[language]}: ${state.latitude}, ${FIELD_LABELS.longitude[language]}: ${state.longitude}`);
      continue;
    }
    const display = reviewDisplayValue(id, state, language);
    if (!display) continue;
    lines.push(`${FIELD_LABELS[id]?.[language] || id}: ${display}`);
  }
  const header: Record<RegistrationLanguage, string> = {
    "en-IN": "Please review your business registration details.",
    "kn-IN": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ವ್ಯವಹಾರ ನೋಂದಾವಣೆ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.",
    "hi-IN": "कृपया अपने व्यवसाय पंजीकरण विवरण की समीक्षा करें।",
  };
  return `${header[language]}\n${lines.join("\n")}`;
}
