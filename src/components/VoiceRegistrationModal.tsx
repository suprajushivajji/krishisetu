"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Play, Square, AlertCircle, CheckCircle2, RefreshCw, XCircle, Pause, Keyboard, Edit3, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { audioEngine, SupportedLanguage } from "@/lib/sharedAudioEngine";
import {
  FIELD_DEFINITIONS,
  REGISTRY_ORDER,
  type RegistrationFormState,
  type RegistrationLanguage,
} from "@/lib/registrationSchema";
import { deterministicExtract } from "@/lib/registrationNormalization";
import {
  RegistrationConversationMachine,
  reviewDisplayValue,
  type AnswerResult,
} from "@/lib/registrationConversation";
import { FIELD_LABELS, UI_STRINGS } from "@/lib/registrationVoice";

const LANGUAGES: { code: RegistrationLanguage; native: string; english: string }[] = [
  { code: "kn-IN", native: "ಕನ್ನಡ", english: "Kannada" },
  { code: "hi-IN", native: "हिन्दी", english: "Hindi" },
  { code: "en-IN", native: "English", english: "Indian English" },
];

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function VoiceRegistrationModal({
  isOpen,
  initialForm,
  onFormChange,
  onSwitchToManual,
  onSubmit,
  onClose,
  submitting,
}: {
  isOpen: boolean;
  initialForm: RegistrationFormState;
  onFormChange: (next: RegistrationFormState) => void;
  onSwitchToManual: () => void;
  onSubmit: () => Promise<{ success: boolean; message?: string }>;
  onClose: () => void;
  submitting: boolean;
}) {
  // All hooks run unconditionally BEFORE any early return.
  const [machine] = useState(() => new RegistrationConversationMachine({ ...initialForm }));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const confirmListeningRef = useRef(false);
  const speakingRef = useRef(false);
  const [, setVersion] = useState(0);
  const [language, setLanguage] = useState<RegistrationLanguage | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clarifyMsg, setClarifyMsg] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ttsUnavailable, setTtsUnavailable] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [initialized, setInitialized] = useState(false);

  const rerender = () => setVersion((n) => n + 1);

  // Initialize shared audio engine
  useEffect(() => {
    if (!isOpen || initialized) return;
    const lang = (machine.language || "en-IN") as SupportedLanguage;
    audioEngine.initialize({
      language: lang,
      onError: (err) => setErrorMsg(err),
      onStateChange: (state) => {
        // Update local state based on audio engine state
        if (state === "recording") {
          setIsRecording(true);
          setStatusText(UI_STRINGS.listening[lang]);
        } else if (state === "speaking") {
          setIsSpeaking(true);
          setStatusText(UI_STRINGS.speaking[lang]);
        } else if (state === "processing") {
          setBusy(true);
          setStatusText(UI_STRINGS.processing[lang]);
        } else if (state === "ready") {
          setIsRecording(false);
          setIsSpeaking(false);
          setBusy(false);
        } else if (state === "error") {
          setIsRecording(false);
          setIsSpeaking(false);
          setBusy(false);
        }
      },
    }).then(() => {
      setInitialized(true);
    }).catch((err) => {
      setErrorMsg(err.message || "Failed to initialize audio engine");
    });
    
    return () => {
      // Don't destroy on close - keep engine alive for next use
    };
  }, [isOpen, machine.language]);

  // Cleanup audio on unmount (close / cancel).
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Cleanup audio whenever the modal becomes hidden or unmounts.
  useEffect(() => {
    if (isOpen) return;
    // Parent may keep us mounted with isOpen=false; stop capture immediately.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    audioEngine.cancelRecording();
    audioEngine.cancelSpeech();
    speakingRef.current = false;
  }, [isOpen]);

  // ------------------------------------------------------------- (functions)
  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    audioEngine.cancelSpeech();
    speakingRef.current = false;
    setIsSpeaking(false);
  }

  async function stopRecorder() {
    setIsRecording(false);
    audioEngine.cancelRecording();
  }

  async function speak(text: string, onDone?: () => void) {
    const lang = (machine.language || "en-IN") as SupportedLanguage;
    stopAudio();
    setClarifyMsg(null);
    setStatusText(UI_STRINGS.speaking[lang]);
    speakingRef.current = true;
    setIsSpeaking(true);

    try {
      await audioEngine.speak(text, lang);
    } catch (err) {
      setTtsUnavailable(true);
      setErrorMsg(`${errMsg(err)}. ${UI_STRINGS.ttsUnavailable[lang]}`);
    } finally {
      speakingRef.current = false;
      setIsSpeaking(false);
      onDone?.();
    }
  }

  function replayQuestion() {
    const q = machine.status === "review" ? machine.reviewText() : machine.currentQuestion();
    if (q) speak(q);
  }

  async function presentCurrent(autoListen: boolean) {
    rerender();
    if (machine.status === "review") {
      setQuestion(machine.reviewText());
      setStatusText(UI_STRINGS.reviewTitle[machine.language || "en-IN"]);
      setClarifyMsg(null);
      if (!ttsUnavailable) await speak(machine.reviewText() || "");
      return;
    }
    const q = machine.currentQuestion();
    setQuestion(q);
    setShowTextInput(false);
    if (q && !ttsUnavailable) {
      if (autoListen && !paused) await speak(q, () => startRecording());
      else await speak(q);
    } else if (q) {
      setStatusText(q);
    }
  }

  async function afterAnswerHandled(result: AnswerResult) {
    onFormChange({ ...machine.formState }); // reflect extracted values in the REAL form
    rerender();
    if (result.errors.length > 0) {
      setClarifyMsg(machine.clarificationFor(result.errors[0].code) || UI_STRINGS.modelUnavailable[machine.language || "en-IN"]);
    }
    await presentCurrent(machine.status !== "review");
  }

  async function startRecording() {
    if (speakingRef.current) return; // never capture the assistant's output
    setErrorMsg(null);
    setTranscript("");
    try {
      await audioEngine.startRecording();
      machine.markRecording();
      setIsRecording(true);
      setStatusText(UI_STRINGS.listening[machine.language || "en-IN"]);
      rerender();
    } catch {
      setErrorMsg("Microphone permission was denied or unavailable. Please type your answer.");
      setPaused(true);
      setShowTextInput(true);
    }
  }

  async function stopRecordingAndProcess() {
    if (!audioEngine.getIsRecording() || !isRecording) return;
    const lang = (machine.language || "en-IN") as SupportedLanguage;
    setIsRecording(false);
    setBusy(true);
    machine.markTranscribing();
    setStatusText(UI_STRINGS.processing[lang]);
    try {
      const blob = await audioEngine.stopRecording();
      const stt = await audioEngine.transcribe(blob, lang);
      if (!stt.success || !stt.transcript) {
        machine.fail(stt.message || "STT failed");
        setErrorMsg(stt.message?.includes("GNANI_API_KEY") ? UI_STRINGS.sttUnavailable[lang] : stt.message || UI_STRINGS.sttUnavailable[lang]);
        return;
      }
      setTranscript(stt.transcript);
      if (confirmListeningRef.current) {
        confirmListeningRef.current = false;
        await handleSpokenConfirm(stt.transcript);
      } else {
        await runExtraction(stt.transcript);
      }
    } catch (err) {
      machine.fail(errMsg(err));
      setErrorMsg(UI_STRINGS.sttUnavailable[lang]);
    } finally {
      setBusy(false);
      rerender();
    }
  }

  async function runExtraction(recognized: string) {
    const lang = (machine.language || "en-IN") as SupportedLanguage;
    machine.markExtracting();
    setBusy(true);
    try {
      const res = await api.extractRegistrationFields({
        transcript: recognized,
        language: lang,
        currentFieldId: machine.currentFieldId,
        formState: machine.formState as unknown as Record<string, unknown>,
      });

      // The /voice/registration/extract route returns `updates` at the TOP level
      // (same convention as /transcribe's `transcript`); fall back to `data.updates`
      // and to client-side deterministic extraction if the call itself failed.
      const raw =
        Array.isArray(res.updates)
          ? res.updates
          : Array.isArray(res.data?.updates)
          ? res.data?.updates
          : [];
      const serverUpdates = (raw as { fieldId: string; value: unknown }[]).map((u) => ({ fieldId: u.fieldId, value: u.value }));
      const baseUpdates = res.success
        ? serverUpdates
        : deterministicExtract(recognized, lang, machine.formState);

      // Free-text fields (business name, contact person, address, taluk,
      // locality, payment terms, description) can only come from the raw answer
      // when neither the model nor deterministic extraction produced one —
      // otherwise the agent would re-ask the same question forever.
      const updates = withFreeTextFallback(baseUpdates, recognized);
      const result = machine.processAnswer(recognized, updates, "voice");
      await afterAnswerHandled(result);
    } finally {
      setBusy(false);
      rerender();
    }
  }

  // If the active question is a plain free-text field and no value was returned
  // for it, use the recognized answer directly as that field's value.
  function withFreeTextFallback(
    updates: { fieldId: string; value: unknown }[],
    recognized: string
  ): { fieldId: string; value: unknown }[] {
    const current = machine.currentFieldId;
    if (current && FIELD_DEFINITIONS[current]?.type === "text" && !updates.some((u) => u.fieldId === current)) {
      const cleaned = recognized.trim();
      if (cleaned) return [...updates, { fieldId: current, value: cleaned }];
    }
    return updates;
  }

  async function submitTypedAnswer() {
    const text = typedAnswer.trim();
    if (!text) return;
    const lang = (machine.language || "en-IN") as SupportedLanguage;
    setBusy(true);
    const current = machine.currentFieldId;
    const proposed = deterministicExtract(text, lang, machine.formState);
    if (current && proposed.every((p) => p.fieldId !== current)) {
      proposed.push({ fieldId: current, value: text });
    }
    const result = machine.processAnswer(text, proposed, "typed");
    setTranscript(text);
    setTypedAnswer("");
    setShowTextInput(false);
    await afterAnswerHandled(result);
    setBusy(false);
    rerender();
  }

  async function chooseLanguage(code: RegistrationLanguage) {
    setLanguage(code);
    setTtsUnavailable(false);
    setErrorMsg(null);
    machine.selectLanguage(code);
    machine.syncFormState({ ...initialForm });
    machine.start();
    await presentCurrent(false);
  }

  async function handleConfirm() {
    const res = machine.confirm();
    if (!res.ok) {
      setErrorMsg(res.error || "Cannot confirm yet");
      return;
    }
    setErrorMsg(null);
    const begin = machine.beginSubmit();
    if (!begin.ok) {
      setErrorMsg(begin.error || "Final validation failed");
      return;
    }
    rerender();
    const submitResult = await onSubmit();
    if (submitResult.success) {
      machine.submitSucceeded();
    } else {
      machine.submitFailed(); // keep entered details for retry
      setErrorMsg(submitResult.message || "Submission failed. Your details are kept — please retry.");
    }
    onFormChange({ ...machine.formState });
    rerender();
  }

  async function startConfirmRecording() {
    confirmListeningRef.current = true;
    await startRecording();
  }

  async function handleSpokenConfirm(recognized: string) {
    const res = machine.confirm(recognized);
    if (!res.ok) {
      setClarifyMsg(UI_STRINGS.confirmSpoken[machine.language || "en-IN"]);
      return;
    }
    await handleConfirm();
  }

  function correctField(fieldId: string) {
    setEditingField(fieldId);
    const current = machine.formState[fieldId as keyof RegistrationFormState];
    setEditValue(Array.isArray(current) ? current.join(", ") : String(current ?? ""));
  }

  async function saveEdit() {
    if (!editingField) return;
    const res = machine.editField(editingField, editValue, "typed");
    if (!res.ok) {
      setClarifyMsg(machine.clarificationFor(res.code || "UNCLEAR"));
      return;
    }
    setEditingField(null);
    setEditValue("");
    onFormChange({ ...machine.formState });
    onFormChange({ ...machine.formState });
    rerender();
    if (machine.status === "review") await presentCurrent(false);
  }

  async function cancelRegistration() {
    await stopRecorder();
    stopAudio();
    machine.cancel();
    onClose();
  }

  async function togglePause() {
    if (paused) {
      setPaused(false);
      await presentCurrent(true);
    } else {
      setPaused(true);
      await stopRecorder();
      stopAudio();
    }
  }

  // ------------------------------------------------------------- early return
  if (!isOpen) return null;

  const lang = machine.language || "en-IN";
  const status = machine.status;

  if (!language) {
    return (
      <div className="modal-backdrop">
        <div className="modal-container voice-modal">
          <ModalHeader title={UI_STRINGS.title["en-IN"]} onClose={cancelRegistration} step={null} />
          <div className="modal-body" style={{ textAlign: "center" }}>
            <Sparkles size={30} style={{ color: "var(--leaf)" }} />
            <h3 style={{ margin: "10px 0 4px", color: "var(--forest)" }}>{UI_STRINGS.chooseLanguage["en-IN"]}</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 18 }}>Select the language for your voice registration.</p>
            <div className="voice-lang-grid">
              {LANGUAGES.map((l) => (
                <button key={l.code} className="voice-lang-card" onClick={() => chooseLanguage(l.code)}>
                  <strong>{l.native}</strong>
                  <span>{l.english}</span>
                </button>
              ))}
            </div>
            <button className="outline-button" style={{ marginTop: 16 }} onClick={onSwitchToManual}>
              {UI_STRINGS.manualEntry["en-IN"]}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const reviewMode = status === "review" || status === "confirming" || status === "submitting" || status === "completed";

  return (
    <div className="modal-backdrop">
      <div className="modal-container voice-modal">
        <ModalHeader title={UI_STRINGS.title[lang]} onClose={cancelRegistration} step={reviewMode ? null : machine.currentStep} />

        {errorMsg && <div className="modal-notice error"><AlertCircle size={16} /><span>{errorMsg}</span></div>}

        {status === "completed" ? (
          <div className="modal-body" style={{ textAlign: "center" }}>
            <CheckCircle2 size={44} style={{ color: "var(--leaf)" }} />
            <h3 style={{ color: "var(--forest)", marginTop: 10 }}>{UI_STRINGS.completed[lang]}</h3>
          </div>
        ) : reviewMode ? (
          <ReviewPanel
            machine={machine}
            lang={lang}
            clarifyMsg={clarifyMsg}
            submitting={submitting || status === "submitting"}
            isRecording={isRecording}
            onConfirm={handleConfirm}
            onStartVoiceConfirm={startConfirmRecording}
            onStopVoiceConfirm={stopRecordingAndProcess}
            onCorrect={correctField}
            onCancel={cancelRegistration}
            editingField={editingField}
            editValue={editValue}
            setEditValue={setEditValue}
            onSaveEdit={saveEdit}
            onCloseEdit={() => setEditingField(null)}
            onReplay={replayQuestion}
          />
        ) : (
          <div className="modal-body">
            {question && (
              <div className="voice-question-box">
                <Volume2 size={16} />
                <p>{question}</p>
                <button className="outline-button small" onClick={replayQuestion} disabled={isSpeaking}>
                  <Play size={13} /> {UI_STRINGS.repeatQuestion[lang]}
                </button>
              </div>
            )}

            {clarifyMsg && <div className="voice-clarify-box">{clarifyMsg}</div>}

            <div className="voice-interactive-center">
              <button
                className={`voice-large-orb ${isRecording ? "active-recording" : ""}`}
                onClick={isRecording ? stopRecordingAndProcess : startRecording}
                disabled={busy || isSpeaking || paused}
              >
                {isRecording ? <MicOff size={42} /> : <Mic size={42} />}
              </button>
              <span className="voice-status-text">
                {isSpeaking ? UI_STRINGS.speaking[lang] : isRecording ? UI_STRINGS.listening[lang] : busy ? UI_STRINGS.processing[lang] : statusText}
              </span>
              {isRecording && (
                <button className="outline-button small" onClick={stopRecordingAndProcess}>
                  <Square size={13} /> Finish & submit answer
                </button>
              )}
            </div>

            {transcript && (
              <div className="transcript-box">
                <small>{UI_STRINGS.youSaid[lang]}:</small>
                <p>“{transcript}”</p>
              </div>
            )}

            <FilledSoFar machine={machine} lang={lang} onEdit={correctField} />

            {showTextInput ? (
              <div className="voice-typed-row">
                <input
                  type="text"
                  autoFocus
                  placeholder={UI_STRINGS.typeAnswer[lang]}
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTypedAnswer()}
                />
                <button className="primary-button" onClick={submitTypedAnswer} disabled={busy || !typedAnswer.trim()}>Save</button>
              </div>
            ) : (
              <button className="outline-button small" onClick={() => setShowTextInput(true)} style={{ marginTop: 8 }}>
                <Keyboard size={13} /> {UI_STRINGS.typeAnswer[lang]}
              </button>
            )}

            <div className="voice-control-bar">
              <button className="outline-button small" onClick={togglePause} disabled={busy}>
                {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? UI_STRINGS.resume[lang] : UI_STRINGS.pause[lang]}
              </button>
              <button className="outline-button small" onClick={startRecording} disabled={busy || isRecording || isSpeaking}>
                <RefreshCw size={13} /> {UI_STRINGS.retryRecording[lang]}
              </button>
              <button className="outline-button small" onClick={onSwitchToManual}>{UI_STRINGS.manualEntry[lang]}</button>
              <button className="link-danger" onClick={cancelRegistration}>{UI_STRINGS.cancel[lang]}</button>
            </div>

            {paused && !isRecording && (
              <button className="primary-button" style={{ marginTop: 10, width: "100%" }} onClick={() => presentCurrent(true)}>
                {UI_STRINGS.resume[lang]} — ask next question
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub components
// ---------------------------------------------------------------------------

function ModalHeader({ title, onClose, step }: { title: string; onClose: () => void; step: 1 | 2 | 3 | null }) {
  return (
    <div className="modal-header">
      <div>
        <span className="modal-badge">
          <Sparkles size={14} /> VOICE REGISTRATION {step ? `• STEP ${step} OF 3` : "• REVIEW"}
        </span>
        <h2>{title}</h2>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Cancel registration"><XCircle size={20} /></button>
    </div>
  );
}

function FilledSoFar({ machine, lang, onEdit }: { machine: RegistrationConversationMachine; lang: RegistrationLanguage; onEdit: (id: string) => void }) {
  const filledIds = [...machine.answered].filter((id) => id !== "longitude");
  if (filledIds.length === 0) return null;
  return (
    <div className="voice-filled-box">
      <small>{UI_STRINGS.filledSoFar[lang]}</small>
      <div className="voice-filled-list">
        {filledIds.map((id) => (
          <div key={id} className="voice-filled-item">
            <span><strong>{FIELD_LABELS[id]?.[lang] || id}:</strong> {reviewDisplayValue(id, machine.formState, lang) || "—"}</span>
            <button className="text-link" onClick={() => onEdit(id)}><Edit3 size={12} /> {UI_STRINGS.edit[lang]}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewPanel({
  machine,
  lang,
  clarifyMsg,
  submitting,
  isRecording,
  onConfirm,
  onStartVoiceConfirm,
  onStopVoiceConfirm,
  onCorrect,
  onCancel,
  editingField,
  editValue,
  setEditValue,
  onSaveEdit,
  onCloseEdit,
  onReplay,
}: {
  machine: RegistrationConversationMachine;
  lang: RegistrationLanguage;
  clarifyMsg: string | null;
  submitting: boolean;
  isRecording: boolean;
  onConfirm: () => void;
  onStartVoiceConfirm: () => void;
  onStopVoiceConfirm: () => void;
  onCorrect: (id: string) => void;
  onCancel: () => void;
  editingField: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  onSaveEdit: () => void;
  onCloseEdit: () => void;
  onReplay: () => void;
}) {
  const order = [...REGISTRY_ORDER[1], ...REGISTRY_ORDER[2], ...REGISTRY_ORDER[3]].filter((id) => id !== "longitude");
  return (
    <div className="modal-body">
      <div className="voice-question-box">
        <Volume2 size={16} />
        <p>{UI_STRINGS.reviewTitle[lang]}</p>
        <button className="outline-button small" onClick={onReplay}><Play size={13} /> Read again</button>
      </div>

      {clarifyMsg && <div className="voice-clarify-box">{clarifyMsg}</div>}

      <div className="voice-review-list">
        {order.map((id) => {
          const display = id === "latitude"
            ? `${machine.formState.latitude}, ${machine.formState.longitude}`
            : reviewDisplayValue(id, machine.formState, lang);
          if (!display) return null;
          return (
            <div key={id} className="voice-review-item">
              <span><strong>{FIELD_LABELS[id]?.[lang] || id}</strong>: {display}</span>
              {editingField === id ? (
                <span className="voice-inline-edit">
                  <input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                  <button className="primary-button small" onClick={onSaveEdit}>Save</button>
                  <button className="outline-button small" onClick={onCloseEdit}>✕</button>
                </span>
              ) : (
                <button className="text-link" onClick={() => onCorrect(id)}><Edit3 size={12} /> {UI_STRINGS.edit[lang]}</button>
              )}
            </div>
          );
        })}
      </div>

      <div className="modal-actions split" style={{ marginTop: 16 }}>
        <button className="outline-button" onClick={onCancel} disabled={submitting}>{UI_STRINGS.cancel[lang]}</button>
        <div className="btn-group">
          <button className="outline-button" onClick={isRecording ? onStopVoiceConfirm : onStartVoiceConfirm} disabled={submitting}>
            <Mic size={13} /> {isRecording ? "Listening… tap to stop" : "Confirm by voice"}
          </button>
          <button className="primary-button" onClick={onConfirm} disabled={submitting}>
            {submitting ? UI_STRINGS.submitting[lang] : UI_STRINGS.confirm[lang]}
          </button>
        </div>
      </div>
    </div>
  );
}
