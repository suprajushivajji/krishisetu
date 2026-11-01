"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Play, Square } from "lucide-react";
import { api } from "@/lib/api";
import { audioEngine, SupportedLanguage } from "@/lib/sharedAudioEngine";
import { getVoiceQuestion, type SupportedLanguage as QuestionLanguage } from "@/lib/voiceQuestions";

export function VoiceAssistantModal({
  isOpen,
  onClose,
  language = "kn",
  district = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  language?: "kn" | "hi" | "en";
  district?: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const initializedRef = useRef(false);
  const configuredQuestion = getVoiceQuestion(language as QuestionLanguage);

  // Initialize shared audio engine
  useEffect(() => {
    if (!isOpen || initializedRef.current) return;
    const lang = (language === "kn" ? "kn-IN" : language === "hi" ? "hi-IN" : "en-IN") as SupportedLanguage;
    audioEngine.initialize({
      language: lang,
      onError: (err) => setErrorMsg(err),
      onStateChange: (state) => {
        setIsRecording(state === "recording");
        setIsPlayingAudio(state === "speaking");
        setLoading(state === "processing");
      },
    }).then(() => {
      initializedRef.current = true;
    }).catch((err) => {
      setErrorMsg(err.message || "Failed to initialize audio engine");
    });
    
    return () => {
      initializedRef.current = false;
    };
  }, [isOpen, language]);

  const startRecording = async () => {
    setErrorMsg(null);
    setTranscript("");
    setResponse(null);

    try {
      await audioEngine.startRecording();
      setIsRecording(true);
    } catch (err: any) {
      setErrorMsg("Microphone permission was denied or is unavailable in your browser.");
    }
  };

  const stopRecording = async () => {
    if (audioEngine.getIsRecording()) {
      try {
        setIsRecording(false);
        setLoading(true);
        const wavBlob = await audioEngine.stopRecording();
        await processAudio(wavBlob);
      } catch (err: any) {
        setErrorMsg("Failed to capture audio: " + err.message);
        setLoading(false);
      }
    }
  };

  const processAudio = async (blob: Blob) => {
    setLoading(true);
    setErrorMsg(null);

    const lang = (language === "kn" ? "kn-IN" : language === "hi" ? "hi-IN" : "en-IN") as SupportedLanguage;
    const sttResult = await audioEngine.transcribe(blob, lang);

    if (sttResult.success && sttResult.transcript) {
      setTranscript(sttResult.transcript);
      await executeVoiceQuery(sttResult.transcript);
    } else {
      if (sttResult.message?.includes("GNANI_API_KEY")) {
        setErrorMsg("⚠️ [Gnani Speech Integration] " + sttResult.message);
      } else {
        setErrorMsg(sttResult.message || "Could not transcribe audio. You can also type your question below.");
      }
      setLoading(false);
    }
  };

  const executeVoiceQuery = async (queryText: string) => {
    setLoading(true);
    const lang = (language === "kn" ? "kn-IN" : language === "hi" ? "hi-IN" : "en-IN") as SupportedLanguage;
    const res = await api.post("/voice/assistant", {
      transcript: queryText,
      languageCode: lang,
      district,
    });

    setLoading(false);
    if (res.success) {
      setResponse(res);
      await playTts(res.response);
    } else {
      setErrorMsg(res.message || "Failed to process query.");
    }
  };

  const playTts = async (textToSpeak: string) => {
    try {
      setIsPlayingAudio(true);
      const lang = (language === "kn" ? "kn-IN" : language === "hi" ? "hi-IN" : "en-IN") as SupportedLanguage;
      await audioEngine.speak(textToSpeak, lang);
      setIsPlayingAudio(false);
    } catch {
      setErrorMsg("Could not connect to the speech service.");
      setIsPlayingAudio(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container voice-modal">
        <div className="modal-header">
          <div>
            <span className="modal-badge">
              <Sparkles size={14} /> GNANI PRISMA v2.5 & TIMBRE v2.5
            </span>
            <h2>{language === "kn" ? "ಕೃಷಿಸೇತು ಧ್ವನಿ ಸಹಾಯಕ" : "KrishiSetu Voice Assistant"}</h2>
            <p>
              {configuredQuestion}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="modal-notice error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="voice-interactive-center">
          <button
            className={`voice-large-orb ${isRecording ? "active-recording" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
          >
            {isRecording ? <MicOff size={42} /> : <Mic size={42} />}
          </button>
          <span className="voice-status-text">
            {isRecording
              ? language === "kn"
                ? "ಆಲಿಸುತ್ತಿದೆ... ಮಾತನಾಡಿ ಮತ್ತು ನಿಲ್ಲಿಸಲು ಕ್ಲಿಕ್ ಮಾಡಿ"
                : "Listening... speak now and click to finish"
              : loading
              ? language === "kn"
                ? "ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲಾಗುತ್ತಿದೆ..."
                : "Processing with Gnani AI..."
              : language === "kn"
              ? "ಮಾತನಾಡಲು ಮೈಕ್ರೋಫೋನ್ ಕ್ಲಿಕ್ ಮಾಡಿ"
              : "Tap microphone to speak"}
          </span>
        </div>

        {transcript && (
          <div className="transcript-box">
            <small>{language === "kn" ? "ನಿಮ್ಮ ಮಾತು (Transcript):" : "You said:"}</small>
            <p>“{transcript}”</p>
          </div>
        )}

        {response && (
          <div className="assistant-response-box">
            <div className="response-header">
              <span className="response-badge">
                <Volume2 size={14} /> {language === "kn" ? "ಕೃಷಿಸೇತು ಉತ್ತರ" : "KrishiSetu Response"}
              </span>
              <button
                className="outline-button small"
                onClick={() => playTts(response.response)}
                disabled={isPlayingAudio}
              >
                {isPlayingAudio ? <Square size={13} /> : <Play size={13} />}
                {isPlayingAudio ? "Playing Audio..." : "Replay Speech"}
              </button>
            </div>
            <p className="response-content">{response.response}</p>

            {response.data && response.data.modalPricePerKg && (
              <div className="mandi-stat-badge">
                <span>{response.data.market}</span>
                <strong>₹{response.data.modalPricePerKg}/kg</strong>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
