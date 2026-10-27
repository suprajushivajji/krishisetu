"use client";

import { useState, useRef } from "react";
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Play, Square } from "lucide-react";
import { api } from "@/lib/api";

export function VoiceAssistantModal({
  isOpen,
  onClose,
  language = "kn",
  district = "",
}: {
  isOpen: boolean;
  onClose: () => void;
  language?: "kn" | "en";
  district?: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const wavRecorderRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const startRecording = async () => {
    setErrorMsg(null);
    setTranscript("");
    setResponse(null);

    try {
      const { WavRecorder } = await import("@/lib/wavRecorder");
      const recorder = new WavRecorder();
      wavRecorderRef.current = recorder;
      await recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setErrorMsg("Microphone permission was denied or is unavailable in your browser.");
    }
  };

  const stopRecording = async () => {
    if (wavRecorderRef.current && isRecording) {
      try {
        setIsRecording(false);
        setLoading(true);
        const wavBlob = await wavRecorderRef.current.stop();
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

    // Call real Gnani STT endpoint
    const sttResult = await api.uploadAudio(blob, language);

    if (sttResult.success && sttResult.transcript) {
      setTranscript(sttResult.transcript);
      await executeVoiceQuery(sttResult.transcript);
    } else {
      // If Gnani API key is not configured or upstream returned unconfigured notice
      if (sttResult.message?.includes("GNANI_API_KEY") || sttResult.message?.includes("503")) {
        setErrorMsg("⚠️ Voice service not configured. Add GNANI_API_KEY to Render environment variables to enable Kannada/English voice features. You can type your question below.");
      } else {
        setErrorMsg(sttResult.message || "Could not transcribe audio. You can also type your question below.");
      }
      setLoading(false);
    }
  };

  const executeVoiceQuery = async (queryText: string) => {
    setLoading(true);
    const res = await api.post("/voice/assistant", {
      transcript: queryText,
      languageCode: language,
      district,
    });

    setLoading(false);
    if (res.success) {
      setResponse(res);
      // Auto-trigger TTS if available
      playTts(res.response);
    } else {
      setErrorMsg(res.message || "Failed to process query.");
    }
  };

  const playTts = async (textToSpeak: string) => {
    try {
      setIsPlayingAudio(true);
      
      // Try browser speech synthesis for English, but for Kannada use Gnani directly
      // Browser speech synthesis often doesn't support Kannada properly
      if (language === "en" && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "en-IN";
        utterance.rate = 1.08;
        utterance.pitch = 1;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => {
          // If browser synthesis fails, try Gnani
          console.log("Browser speech synthesis failed, trying Gnani API");
          playGnaniTts(textToSpeak);
        };
        window.speechSynthesis.speak(utterance);
        return;
      }

      // For Kannada or if browser synthesis fails, use Gnani API
      await playGnaniTts(textToSpeak);
    } catch (err: any) {
      console.error("TTS error:", err);
      setErrorMsg("Failed to play audio: " + err.message);
      setIsPlayingAudio(false);
    }
  };

  const playGnaniTts = async (textToSpeak: string) => {
    try {
      const result = await api.synthesizeSpeech({
        text: textToSpeak,
        languageCode: language,
        voiceGender: "female",
      });

      if (!result.success || !result.audioBlob) {
        setErrorMsg(result.message || "Voice service unavailable. Add GNANI_API_KEY to Render for Kannada voice support.");
        setIsPlayingAudio(false);
        return;
      }

      const audioUrl = URL.createObjectURL(result.audioBlob);
      if (audioPlayerRef.current) {
        const player = audioPlayerRef.current;
        player.pause();
        player.src = audioUrl;
        player.load();
        player.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsPlayingAudio(false);
        };
        player.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setErrorMsg("Audio playback failed. The speech response was not a supported audio format.");
          setIsPlayingAudio(false);
        };
        try {
          await player.play();
        } catch {
          setErrorMsg("Audio is ready. Press Replay Speech to allow playback in this browser.");
          setIsPlayingAudio(false);
        }
      }
    } catch (err: any) {
      console.error("Gnani TTS error:", err);
      setErrorMsg("Voice service error: " + err.message);
      setIsPlayingAudio(false);
    }
  };
      setErrorMsg("Could not connect to the speech service.");
      setIsPlayingAudio(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <audio ref={audioPlayerRef} style={{ display: "none" }} />
      <div className="modal-container voice-modal">
        <div className="modal-header">
          <div>
            <span className="modal-badge">
              <Sparkles size={14} /> GNANI PRISMA v2.5 & TIMBRE v2.5
            </span>
            <h2>{language === "kn" ? "ಕೃಷಿಸೇತು ಧ್ವನಿ ಸಹಾಯಕ" : "KrishiSetu Voice Assistant"}</h2>
            <p>
              {language === "kn"
                ? "ಟೊಮೇಟೊ ಬೆಲೆ, ಹತ್ತಿರದ ಖರೀದಿದಾರರು ಅಥವಾ ಲಾಭದ ಲೆಕ್ಕಾಚಾರದ ಬಗ್ಗೆ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ."
                : "Ask about crop rates, nearby buyers or net earnings in Kannada or English."}
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

        {/* Quick sample chips */}
        <div className="voice-samples">
          <small>{language === "kn" ? "ಉದಾಹರಣೆ ಪ್ರಶ್ನೆಗಳು:" : "Try asking:"}</small>
          <div className="chips-container">
            <button
              className="chip-button"
              onClick={() => {
                setTranscript("ದಾವಣಗೆರೆ ಮಂಡಿಯಲ್ಲಿ ಇಂದಿನ ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?");
                executeVoiceQuery("ದಾವಣಗೆರೆ ಮಂಡಿಯಲ್ಲಿ ಇಂದಿನ ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?");
              }}
            >
              🍅 {language === "kn" ? "ಇಂದಿನ ಟೊಮೇಟೊ ದರ" : "Today's tomato rate"}
            </button>
            <button
              className="chip-button"
              onClick={() => {
                setTranscript("ದಾವಣಗೆರೆಯಲ್ಲಿ ಟೊಮೇಟೊ ಖರೀದಿದಾರರು ಯಾರು?");
                executeVoiceQuery("ದಾವಣಗೆರೆಯಲ್ಲಿ ಟೊಮೇಟೊ ಖರೀದಿದಾರರು ಯಾರು?");
              }}
            >
              🏪 {language === "kn" ? "ಹತ್ತಿರದ ಖರೀದಿದಾರರು" : "Find buyers near me"}
            </button>
            <button
              className="chip-button"
              onClick={() => {
                setTranscript("500 ಕೆಜಿ ಬೆಳೆಗೆ ಎಷ್ಟು ಲಾಭ ಬರುತ್ತದೆ?");
                executeVoiceQuery("500 ಕೆಜಿ ಬೆಳೆಗೆ ಎಷ್ಟು ಲಾಭ ಬರುತ್ತದೆ?");
              }}
            >
              💰 {language === "kn" ? "500 ಕೆಜಿ ನಿವ್ವಳ ಲಾಭ" : "500kg net earnings"}
            </button>
          </div>
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
