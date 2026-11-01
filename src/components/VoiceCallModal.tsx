"use client";

import { useState, useRef, useEffect } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, MessageSquare, Download, Share2, X } from "lucide-react";
import { api } from "@/lib/api";
import { audioEngine, SupportedLanguage } from "@/lib/sharedAudioEngine";
import { getVoiceQuestion } from "@/lib/voiceQuestions";

interface TranscriptSegment {
  speaker: "farmer" | "assistant";
  text: string;
  language: string;
  sequence: number;
  startTime: string;
  isFinal: boolean;
}

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: "kn-IN" | "hi-IN" | "en-IN";
  district?: string;
}

export function VoiceCallModal({ isOpen, onClose, language: initialLanguage = "kn-IN", district = "" }: VoiceCallModalProps) {
  const [language, setLanguage] = useState<"kn-IN" | "hi-IN" | "en-IN">(initialLanguage);
  const [callStatus, setCallStatus] = useState<"idle" | "connecting" | "active" | "ended">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [audioVolume, setAudioVolume] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [listenMode, setListenMode] = useState<"listening" | "paused" | "thinking">("listening");
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [currentAssistantResponse, setCurrentAssistantResponse] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showDelivery, setShowDelivery] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<"whatsapp" | "sms" | "manual">("manual");
  const [languageSelected, setLanguageSelected] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callStatusRef = useRef<"idle" | "connecting" | "active" | "ended">("idle");
  const isMutedRef = useRef(false);
  const turnInFlightRef = useRef(false);
  const lastUtteranceRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });
  const hasSpeechRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRecordingRef = useRef<() => void>(() => undefined);

  // Keep refs in sync for use inside callbacks
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Initialize shared audio engine
  useEffect(() => {
    if (!isOpen) return;
    const lang = language as SupportedLanguage;
    audioEngine.initialize({
      language: lang,
      onError: (err) => setError(err),
      onStateChange: (state) => {
        setListenMode(state === "recording" ? "listening" : state === "speaking" ? "thinking" : "paused");
      },
      onAudioLevel: (level) => {
        if (!audioEngine.getIsRecording() || turnInFlightRef.current) return;
        if (level > 0.035) {
          hasSpeechRef.current = true;
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        } else if (hasSpeechRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            finishRecordingRef.current();
          }, 900);
        }
      },
    }).catch((err) => {
      setError(err.message || "Failed to initialize audio engine");
    });
    
    return () => {
      // Don't destroy on close - keep engine alive for next call
    };
  }, [isOpen, language]);

  useEffect(() => {
    if (!isOpen && callStatusRef.current === "active") {
      // Modal closed mid-call: stop everything immediately
      audioEngine.cancelRecording();
      audioEngine.cancelSpeech();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      setCallStatus("ended");
    }
  }, [isOpen]);

  useEffect(() => {
    if (callStatus === "active") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startCall = async () => {
    try {
      setError(null);
      setCallStatus("connecting");

      // Create call session
      const sessionRes = await api.post("/calls", {
        language,
        mode: "in_app",
        district,
        state: "Karnataka",
      });

      if (sessionRes.success && sessionRes.session?.sessionId) {
        setSessionId(sessionRes.session.sessionId);

        // Start the call
        await api.post(`/calls/${sessionRes.session.sessionId}/start`);
        setCallStatus("active");

        // Add initial system message
        const greeting = getVoiceQuestion(language === "kn-IN" ? "kn" : language === "hi-IN" ? "hi" : "en");
        addTranscriptSegment("assistant", greeting, language);
        
        // Start listening for user input
        await startListening();
      } else {
        throw new Error(sessionRes.message || "Call session could not be created.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to start call");
      setCallStatus("idle");
    }
  };

  const startListening = async () => {
    if (turnInFlightRef.current || callStatusRef.current !== "active" || isMutedRef.current || audioEngine.getIsSpeaking()) return;
    
    try {
      hasSpeechRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      setListenMode("listening");
      await audioEngine.startRecording();
    } catch (err: any) {
      setError("Microphone permission was denied or unavailable: " + err.message);
    }
  };

  async function stopListeningAndProcess() {
    if (!audioEngine.getIsRecording()) return;
    
    turnInFlightRef.current = true;
    hasSpeechRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    setListenMode("thinking");
    
    try {
      const wavBlob = await audioEngine.stopRecording();
      await processAudio(wavBlob);
    } catch (err: any) {
      setError("Failed to capture audio: " + err.message);
      turnInFlightRef.current = false;
      await startListening();
    }
  }

  useEffect(() => {
    finishRecordingRef.current = () => {
      void stopListeningAndProcess();
    };
  }, [stopListeningAndProcess]);

  const processAudio = async (blob: Blob) => {
    const lang = language as SupportedLanguage;
    const sttResult = await audioEngine.transcribe(blob, lang);

    if (sttResult.success && sttResult.transcript) {
      const text = sttResult.transcript.trim();
      
      // De-duplicate: recognition sometimes emits the same sentence twice
      const norm = text.toLowerCase();
      const now = Date.now();
      if (norm === lastUtteranceRef.current.text && now - lastUtteranceRef.current.time < 5000) {
        console.log("Ignored duplicate utterance:", text);
        turnInFlightRef.current = false;
        await startListening();
        return;
      }
      lastUtteranceRef.current = { text: norm, time: now };

      if (text.length > 0) {
        await handleVoiceInput(text);
      } else {
        turnInFlightRef.current = false;
        await startListening();
      }
    } else {
      if (sttResult.message?.includes("GNANI_API_KEY")) {
        setError("⚠️ [Gnani Speech Integration] " + sttResult.message);
      } else {
        setError(sttResult.message || "Could not transcribe audio");
      }
      turnInFlightRef.current = false;
      await startListening();
    }
  };

  const resumeListening = async () => {
    if (callStatusRef.current !== "active" || isMutedRef.current || audioEngine.getIsSpeaking()) return;
    turnInFlightRef.current = false;
    await startListening();
  };

  const endCall = async () => {
    try {
      if (sessionId) {
        // Generate final transcript
        const finalTranscript = transcript.map(s => `${s.speaker === "farmer" ? "ನೀವು" : "ಕೃಷಿಸೇತು"}: ${s.text}`).join("\n");

        // Generate summary
        const summary = `ಕರೆಯ ಅವಧಿ: ${formatDuration(callDuration)}. ${transcript.length} ಸಂಭಾಷಣೆಗಳು.`;

        await api.post(`/calls/${sessionId}/end`, {
          finalTranscript,
          summary,
        });
      }

      // Cleanup: stop everything
      audioEngine.cancelRecording();
      audioEngine.cancelSpeech();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
      
      setCallStatus("ended");
    } catch (err: any) {
      console.error("Error ending call:", err);
      setError(err.message);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      audioEngine.cancelRecording();
      setListenMode("paused");
    } else {
      resumeListening();
    }
  };

  const addTranscriptSegment = (speaker: "farmer" | "assistant", text: string, lang: string) => {
    const segment: TranscriptSegment = {
      speaker,
      text,
      language: lang,
      sequence: transcript.length + 1,
      startTime: new Date().toISOString(),
      isFinal: true,
    };
    setTranscript((prev) => [...prev, segment]);

    // Save to backend
    if (sessionId) {
      api.post(`/calls/${sessionId}/transcript/segment`, {
        speaker,
        text,
        language: lang,
        isFinal: true,
      }).catch(console.error);
    }
  };

  const handleVoiceInput = async (text: string) => {
    try {
      addTranscriptSegment("farmer", text, language);
      setListenMode("thinking");

      const response = await api.post("/voice/assistant", {
        transcript: text,
        languageCode: language,
        district,
      });

      if (!response.success || !response.response) {
        throw new Error(response.message || "The assistant could not generate a response.");
      }

      setCurrentAssistantResponse(response.response);
      addTranscriptSegment("assistant", response.response, language);

      if (isAudioEnabled) {
        await playAudio(response.response, language);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not process that turn.");
    } finally {
      turnInFlightRef.current = false;
      await resumeListening();
    }
  };

  // Speaks the FULL reply using shared audio engine (Gnani TTS + browser fallback)
  // Resolves only when playback truly finishes, so the mic stays closed until
  // then and the assistant can never "hear itself".
  const playAudio = async (text: string, lang: string): Promise<void> => {
    setIsPlaying(true);
    await audioEngine.speak(text, lang as SupportedLanguage);
    setIsPlaying(false);
  };

  const generateCallSummary = () => {
    const farmerMessages = transcript.filter(s => s.speaker === "farmer").map(s => s.text);
    const assistantMessages = transcript.filter(s => s.speaker === "assistant").map(s => s.text);
    
    const summary = `ಕೃಷಿಸೇತು ಧ್ವನಿ ಕರೆ - ${new Date().toLocaleDateString()}\n\n` +
      `ಕರೆಯ ಅವಧಿ: ${formatDuration(callDuration)}\n` +
      `ಸಂಭಾಷಣೆಗಳು: ${transcript.length}\n\n` +
      `ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳು:\n${farmerMessages.slice(0, 3).join("\n")}\n\n` +
      `ಕೃಷಿಸೇತು ಉತ್ತರಗಳು:\n${assistantMessages.slice(0, 3).join("\n")}\n\n` +
      `ಸಂಪೂರ್ಣ ಸಂಭಾಷಣೆ:\n${transcript.map(s => `${s.speaker === "farmer" ? "ನೀವು" : "ಕೃಷಿಸೇತು"}: ${s.text}`).join("\n")}`;
    
    return summary;
  };

  const downloadTranscript = () => {
    const transcriptText = transcript
      .map((s) => `${s.speaker === "farmer" ? "Farmer" : "Assistant"}: ${s.text}`)
      .join("\n");

    const blob = new Blob([transcriptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `krishisetu-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareWhatsApp = () => {
    const summary = transcript
      .map((s) => `${s.speaker === "farmer" ? "ನೀವು" : "ಕೃಷಿಸೇತು"}: ${s.text}`)
      .join("\n");

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(whatsappUrl, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container voice-call-modal">
        <div className="call-header">
          <div className="call-info">
            <h2>ಕೃಷಿಸೇತು ಧ್ವನಿ ಕರೆ</h2>
            <div className="call-status">
              <span className={`status-badge ${callStatus}`}>
                {callStatus === "idle" && "Ready"}
                {callStatus === "connecting" && "Connecting..."}
                {callStatus === "active" && "In Call"}
                {callStatus === "ended" && "Ended"}
              </span>
              {callStatus === "active" && (
                <span className="duration">
                  <Clock size={14} /> {formatDuration(callDuration)}
                </span>
              )}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="call-body">
          {callStatus === "idle" && (
            <div className="call-idle-state">
              <div className="call-icon">
                <Phone size={48} />
              </div>
              <p>ಧ್ವನಿ ಕರೆಯನ್ನು ಪ್ರಾರಂಭಿಸಲು ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ</p>
              <p className="subtext">Start voice call by pressing the button below</p>
              {!languageSelected && (
                <div className="language-selection">
                  <p className="language-prompt">Select your language / ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ / अपनी भाषा चुನें:</p>
                  <div className="language-buttons">
                    <button className="language-btn" onClick={() => { setLanguage("kn-IN"); setLanguageSelected(true); }}>
                      ಕನ್ನಡ
                    </button>
                    <button className="language-btn" onClick={() => { setLanguage("hi-IN"); setLanguageSelected(true); }}>
                      हिंदी
                    </button>
                    <button className="language-btn" onClick={() => { setLanguage("en-IN"); setLanguageSelected(true); }}>
                      English
                    </button>
                  </div>
                </div>
              )}
              <div className="language-selector">
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value as "kn-IN" | "hi-IN" | "en-IN");
                    setLanguageSelected(true);
                  }}
                  disabled={callStatus !== "idle"}
                >
                  <option value="kn-IN">ಕನ್ನಡ (Kannada)</option>
                  <option value="hi-IN">हिंदी (Hindi)</option>
                  <option value="en-IN">English</option>
                </select>
              </div>
            </div>
          )}

          {callStatus === "active" && (
            <div className="call-active-state">
              <div className="assistant-avatar">
                <div className="avatar-pulse">
                  <Volume2 size={32} />
                </div>
                <span>ಕೃಷಿಸೇತು</span>
              </div>

              {/* Half-duplex status: mic is only open during the user's turn */}
              <div className={`call-mic-status ${listenMode}`}>
                {listenMode === "listening" && "🎤 ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ... (I'm listening — speak, I won't interrupt)"}
                {listenMode === "thinking" && "⏳ ಉತ್ತರ ಹುಡುಕುತ್ತಿದೆ... (Finding your answer...)"}
                {listenMode === "paused" && "🔇 ಸಹಾಯಕ ಮಾತನಾಡುತ್ತಿದೆ / ಮೈಕ್ ನಿಲ್ಲಿಸಲಾಗಿದೆ (Assistant talking — mic paused)"}
              </div>

              {showTranscript && (
                <div className="live-transcript">
                  <div className="transcript-header">
                    <span className="transcript-title">
                      <MessageSquare size={14} /> Live Transcript
                    </span>
                    <button
                      className="text-btn"
                      onClick={() => setShowTranscript(false)}
                    >
                      Hide
                    </button>
                  </div>
                  <div className="transcript-content">
                    {transcript.map((segment, index) => (
                      <div
                        key={`${segment.speaker}-${segment.sequence}-${index}`}
                        className={`transcript-message ${segment.speaker}`}
                      >
                        <span className="speaker-label">
                          {segment.speaker === "farmer" ? "ನೀವು" : "ಕೃಷಿಸೇತು"}
                        </span>
                        <p>{segment.text}</p>
                        {segment.speaker === "assistant" && (
                          <button
                            className="play-audio-btn"
                            onClick={() => playAudio(segment.text, segment.language)}
                            title="Play audio"
                          >
                            <Volume2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick action buttons for voice input */}
              <div className="quick-actions">
                <button
                  className="action-chip"
                  onClick={() => handleVoiceInput("ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?")}
                >
                  🍅 ಟೊಮೇಟೊ ಬೆಲೆ?
                </button>
                <button
                  className="action-chip"
                  onClick={() => handleVoiceInput("ಹತ್ತಿರದ ಖರೀದಿದಾರರು ಯಾರಿದ್ದಾರೆ?")}
                >
                  👥 ಖರೀದಿದಾರರು?
                </button>
                <button
                  className="action-chip"
                  onClick={() => handleVoiceInput("500 ಕೆಜಿ ಬೆಳೆಗೆ ಎಷ್ಟು ಲಾಭ?")}
                >
                  💰 500ಕೆಜಿ ಲಾಭ?
                </button>
              </div>
            </div>
          )}

          {callStatus === "ended" && (
            <div className="call-ended-state">
              {!showDelivery ? (
                <>
                  <div className="call-summary">
                    <div className="summary-icon">
                      <PhoneOff size={48} />
                    </div>
                    <h3>ಕರೆ ಮುಗಿದಿದೆ</h3>
                    <p>Call Ended</p>
                    <div className="call-stats">
                      <div className="stat">
                        <Clock size={16} />
                        <span>Duration: {formatDuration(callDuration)}</span>
                      </div>
                      <div className="stat">
                        <MessageSquare size={16} />
                        <span>Messages: {transcript.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="transcript-preview">
                    <h4>ಸಂಭಾಷಣೆಯ ಸಾರಾಂಶ</h4>
                    <p className="summary-text">
                      {transcript.slice(0, 4).map(s => s.text).join(" • ")}
                      {transcript.length > 4 && "..."}
                    </p>
                  </div>

                  <div className="transcript-actions">
                    <button className="action-button" onClick={downloadTranscript}>
                      <Download size={16} />
                      Download Transcript
                    </button>
                    <button className="action-button primary" onClick={() => setShowDelivery(true)}>
                      <Share2 size={16} />
                      Send Message
                    </button>
                  </div>
                </>
              ) : (
                <div className="delivery-state">
                  <h3>ಸಂದೇಶ ಕಳುಹಿಸಿ</h3>
                  <p>Send this conversation summary to your phone</p>

                  <div className="delivery-form">
                    <div className="form-group">
                      <label>ಫೋನ್ ನಂಬರ್ (Phone Number)</label>
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>ವಿಧಾನ (Delivery Method)</label>
                      <div className="delivery-methods">
                        <button
                          className={`method-option ${selectedDeliveryMethod === "manual" ? "selected" : ""}`}
                          onClick={() => setSelectedDeliveryMethod("manual")}
                        >
                          <input type="radio" checked={selectedDeliveryMethod === "manual"} readOnly />
                          <span>WhatsApp (Manual)</span>
                        </button>
                        <button
                          className={`method-option ${selectedDeliveryMethod === "whatsapp" ? "selected" : ""}`}
                          onClick={() => setSelectedDeliveryMethod("whatsapp")}
                          disabled
                        >
                          <input type="radio" checked={selectedDeliveryMethod === "whatsapp"} readOnly />
                          <span>WhatsApp API</span>
                          <span className="badge">Coming Soon</span>
                        </button>
                        <button
                          className={`method-option ${selectedDeliveryMethod === "sms" ? "selected" : ""}`}
                          onClick={() => setSelectedDeliveryMethod("sms")}
                          disabled
                        >
                          <input type="radio" checked={selectedDeliveryMethod === "sms"} readOnly />
                          <span>SMS</span>
                          <span className="badge">Coming Soon</span>
                        </button>
                      </div>
                    </div>

                    <div className="message-preview">
                      <label>ಸಂದೇಶದ ಪೂರ್ವಾಲೋಕನ (Message Preview)</label>
                      <textarea
                        readOnly
                        value={generateCallSummary()}
                        rows={6}
                      />
                    </div>

                    <div className="consent-section">
                      <label className="consent-label">
                        <input
                          type="checkbox"
                          id="consent"
                          onChange={(e) => {
                            if (e.target.checked && sessionId) {
                              api.post(`/calls/${sessionId}/consent`).catch(console.error);
                            }
                          }}
                        />
                        <span>
                          I consent to send this conversation summary to the provided phone number
                        </span>
                      </label>
                    </div>

                    <div className="delivery-actions">
                      <button className="action-button" onClick={() => setShowDelivery(false)}>
                        Back
                      </button>
                      <button
                        className="action-button primary"
                        onClick={() => {
                          if (recipientPhone) {
                            const summary = generateCallSummary();
                            if (selectedDeliveryMethod === "manual") {
                              const whatsappUrl = `https://wa.me/${recipientPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(summary)}`;
                              window.open(whatsappUrl, "_blank");
                              
                              // Record delivery
                              if (sessionId) {
                                api.post(`/calls/${sessionId}/send-transcript`, {
                                  provider: "manual_whatsapp",
                                  recipientPhone,
                                  message: summary,
                                }).catch(console.error);
                              }
                            }
                          }
                        }}
                        disabled={!recipientPhone}
                      >
                        <Share2 size={16} />
                        Send Now
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="call-controls">
          {callStatus === "idle" && (
            <button className="call-button start" onClick={startCall}>
              <Phone size={24} />
              Start Call
            </button>
          )}

          {callStatus === "active" && (
            <>
              <button
                className={`control-button ${isMuted ? "muted" : ""}`}
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <button
                className={`control-button ${!isAudioEnabled ? "muted" : ""}`}
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                aria-label={isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
              >
                {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>

              <button
                className="call-button end"
                onClick={endCall}
                aria-label="End Call"
              >
                <PhoneOff size={24} />
                End
              </button>
            </>
          )}

          {callStatus === "ended" && (
            <button className="call-button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
