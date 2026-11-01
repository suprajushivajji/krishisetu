/**
 * Shared Audio Engine for KrishiSetu Voice Interfaces
 * 
 * Single source of truth for:
 * - Microphone acquisition and device selection
 * - Recording lifecycle (start/stop/pause/resume)
 * - STT request/response handling (Gnani Prisma)
 * - TTS request/playback (Gnani Timbre + browser fallback)
 * - Language code normalization (kn-IN, hi-IN, en-IN)
 * - Audio playback state management
 * - Recording/playback mutual exclusion
 * - Error handling and cleanup
 * - Turn-based conversation management
 */

import { api } from "./api";
import { cancelBrowserSpeech } from "./browserTTS";

export type SupportedLanguage = "kn-IN" | "hi-IN" | "en-IN";

export type VoiceState =
  | "idle"
  | "listening"
  | "user-speaking"
  | "finalizing-recording"
  | "transcribing"
  | "processing"
  | "speaking"
  | "error";

export function normalizeLanguageCode(code: string): SupportedLanguage {
  const normalized = code.trim().toLowerCase();
  if (normalized === "kn" || normalized.startsWith("kn-") || normalized.includes("kannada")) return "kn-IN";
  if (normalized === "hi" || normalized.startsWith("hi-") || normalized.includes("hindi")) return "hi-IN";
  if (normalized === "en" || normalized.startsWith("en-") || normalized.includes("english")) return "en-IN";
  throw new Error(`Unsupported voice language: ${code}`);
}

export interface AudioEngineConfig {
  language: SupportedLanguage;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: AudioEngineState) => void;
  onAudioLevel?: (level: number) => void;
}

export type AudioEngineState = 
  | "idle"
  | "initializing"
  | "ready"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

export interface TurnResult {
  transcript: string;
  isFinal: boolean;
  turnId: string;
}

export interface TTSResult {
  success: boolean;
  audioBlob?: Blob;
  error?: string;
}

class SharedAudioEngine {
  private static instance: SharedAudioEngine | null = null;
  
  // Audio resources - PERSISTENT across turns
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private input: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  // State management
  private state: AudioEngineState = "idle";
  private config: AudioEngineConfig | null = null;
  private isRecording = false;
  private isSpeaking = false;
  private isProcessing = false;
  private currentTurnId: string | null = null;
  private pendingSTTRequest: Promise<{
    success: boolean;
    transcript: string;
    isFinal: boolean;
    turnId: string;
    message?: string;
  }> | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioCancel: (() => void) | null = null;
  
  // Audio level monitoring
  private levelCheckInterval: ReturnType<typeof setInterval> | null = null;
  
  // Device management
  private availableDevices: MediaDeviceInfo[] = [];
  private selectedDeviceId: string | null = null;
  
  // Turn management
  private turnCounter = 0;
  private lastTranscript = "";
  private lastTranscriptTime = 0;
  
  // Cleanup tracking
  private isDestroyed = false;

  private constructor() {}

  static getInstance(): SharedAudioEngine {
    if (!SharedAudioEngine.instance) {
      SharedAudioEngine.instance = new SharedAudioEngine();
    }
    return SharedAudioEngine.instance;
  }

  static destroyInstance(): void {
    if (SharedAudioEngine.instance) {
      SharedAudioEngine.instance.destroy();
      SharedAudioEngine.instance = null;
    }
  }

  /**
   * Initialize the audio engine with configuration
   * Creates persistent audio context that stays alive across turns
   */
  async initialize(config: AudioEngineConfig): Promise<void> {
    if (this.isDestroyed) throw new Error("Audio engine has been destroyed");
    
    this.config = config;
    this.setState("initializing");
    
    try {
      // Enumerate audio input devices
      await this.enumerateDevices();
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      await this.audioContext.resume();
      
      this.setState("ready");
    } catch (error) {
      this.setState("error");
      throw error;
    }
  }

  /**
   * Enumerate available audio input devices
   */
  async enumerateDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter(d => d.kind === "audioinput");
      return this.availableDevices;
    } catch (error) {
      console.warn("Could not enumerate audio devices:", error);
      this.availableDevices = [];
      return [];
    }
  }

  /**
   * Get available audio input devices
   */
  getAvailableDevices(): MediaDeviceInfo[] {
    return this.availableDevices;
  }

  /**
   * Set the selected microphone device
   */
  setSelectedDevice(deviceId: string | null): void {
    this.selectedDeviceId = deviceId;
  }

  /**
   * Get current selected device
   */
  getSelectedDevice(): string | null {
    return this.selectedDeviceId;
  }

  /**
   * Start recording - acquires microphone and begins capturing audio
   * Reuses existing audio context if available
   */
  async startRecording(): Promise<void> {
    if (this.isDestroyed) throw new Error("Audio engine has been destroyed");
    if (this.isRecording) return;
    if (this.isSpeaking) {
      console.warn("Cannot start recording while speaking");
      return;
    }
    if (!this.audioContext) await this.initialize(this.config!);

    try {
      // Get user media with echo cancellation
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          ...(this.selectedDeviceId ? { deviceId: { exact: this.selectedDeviceId } } : {}),
        },
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.recordedChunks = [];
      this.currentTurnId = `turn_${++this.turnCounter}_${Date.now()}`;
      const mimeType = this.getRecorderMimeType();
      this.recorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);
      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      };
      this.recorder.start(250);

      this.input = this.audioContext!.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext!.createAnalyser();
      this.analyser.fftSize = 2048;
      this.input.connect(this.analyser);
      this.isRecording = true;
      this.setState("recording");

      // Start audio level monitoring
      this.startLevelMonitoring();

      this.config?.onStateChange?.(this.state);
    } catch (error) {
      this.isRecording = false;
      this.setState("error");
      const errorMsg = error instanceof Error ? error.message : "Failed to start recording";
      this.config?.onError?.(errorMsg);
      throw error;
    }
  }

  /**
   * Stop recording and return the complete audio blob
   * Keeps audio context alive for next turn
   */
  async stopRecording(): Promise<Blob> {
    if (!this.isRecording) {
      throw new Error("Not currently recording");
    }

    this.isRecording = false;
    this.setState("processing");
    this.stopLevelMonitoring();

    const finalizedAt = performance.now();
    const recordedBlob = await this.stopRecorderAndBuildBlob();
    console.info("[voice] recording finalized", {
      milliseconds: Math.round(performance.now() - finalizedAt),
      bytes: recordedBlob.size,
      type: recordedBlob.type,
    });

    // Disconnect audio nodes but KEEP audio context alive
    if (this.input) {
      this.input.disconnect();
      this.input = null;
    }
    if (this.analyser) {
      this.analyser = null;
    }

    // Stop media stream tracks only after MediaRecorder emits its final chunk.
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    // DO NOT close audio context - keep it alive for next turn!
    // Only close on destroy()

    this.setState("ready");
    return recordedBlob;
  }

  /**
   * Pause recording without closing audio context
   * Useful for half-duplex: pause while assistant speaks
   */
  async pauseRecording(): Promise<void> {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    this.stopLevelMonitoring();

    if (this.recorder && this.recorder.state !== "inactive") {
      await this.stopRecorderAndBuildBlob();
    }

    if (this.analyser) {
      this.analyser = null;
    }

    // Keep mediaStream alive for quick resume
    this.setState("ready");
  }

  /**
   * Resume recording after pause (faster than full startRecording)
   */
  async resumeRecording(): Promise<void> {
    if (this.isDestroyed) throw new Error("Audio engine has been destroyed");
    if (this.isRecording) return;
    if (this.isSpeaking) {
      console.warn("Cannot resume recording while speaking");
      return;
    }
    if (!this.mediaStream) {
      // No paused stream, do full start
      return this.startRecording();
    }

    try {
      this.recordedChunks = [];
      this.currentTurnId = `turn_${++this.turnCounter}_${Date.now()}`;
      const mimeType = this.getRecorderMimeType();
      this.recorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);
      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data);
      };
      this.recorder.start(250);
      this.input = this.audioContext!.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext!.createAnalyser();
      this.analyser.fftSize = 2048;
      this.input.connect(this.analyser);
      this.isRecording = true;
      this.setState("recording");

      this.startLevelMonitoring();
      this.config?.onStateChange?.(this.state);
    } catch (error) {
      this.isRecording = false;
      this.setState("error");
      const errorMsg = error instanceof Error ? error.message : "Failed to resume recording";
      this.config?.onError?.(errorMsg);
      throw error;
    }
  }

  /**
   * Cancel current recording without returning audio
   */
  async cancelRecording(): Promise<void> {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    this.stopLevelMonitoring();

    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null;
    if (this.input) this.input.disconnect();
    this.input = null;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    // Keep audio context alive

    this.recordedChunks = [];
    this.currentTurnId = null;
    this.setState("ready");
  }

  /**
   * Send recorded audio to Gnani STT
   */
  async transcribe(audioBlob: Blob, language: SupportedLanguage): Promise<{ success: boolean; transcript: string; isFinal: boolean; turnId: string; message?: string }> {
    if (this.pendingSTTRequest) {
      return this.pendingSTTRequest;
    }

    this.isProcessing = true;
    this.setState("processing");
    this.pendingSTTRequest = (async () => {
      const startedAt = performance.now();
      try {
        const result = await api.uploadAudio(audioBlob, language);
        console.info("[voice] STT completed", {
          milliseconds: Math.round(performance.now() - startedAt),
          bytes: audioBlob.size,
          language,
          success: result.success,
        });
        return {
          success: result.success,
          transcript: result.transcript || "",
          isFinal: result.success,
          turnId: this.currentTurnId || "",
          message: result.message,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "STT failed";
        this.config?.onError?.(errorMsg);
        return {
          success: false,
          transcript: "",
          isFinal: false,
          turnId: this.currentTurnId || "",
          message: errorMsg,
        };
      } finally {
        this.pendingSTTRequest = null;
        this.isProcessing = false;
        if (!this.isRecording && !this.isSpeaking) this.setState("ready");
      }
    })();

    return this.pendingSTTRequest;
  }

  /**
   * Speak text using Gnani TTS with browser fallback
   */
  async speak(text: string, language: SupportedLanguage): Promise<TTSResult> {
    if (this.isDestroyed) return { success: false, error: "Engine destroyed" };
    if (!text.trim()) return { success: true };

    if (this.isRecording) await this.cancelRecording();

    // Cancel any ongoing speech
    await this.cancelSpeech();

    this.isSpeaking = true;
    this.setState("speaking");
    const startedAt = performance.now();

    try {
      // Try Gnani TTS first
      const result = await api.synthesizeSpeech({
        text,
        languageCode: language,
        voiceGender: "female",
      });

      if (result.success && result.audioBlob) {
        console.info("[voice] TTS audio ready", {
          milliseconds: Math.round(performance.now() - startedAt),
          bytes: result.audioBlob.size,
          type: result.audioBlob.type,
          language,
        });
        const playback = await this.playAudioBlob(result.audioBlob);
        if (!playback.success) throw new Error(playback.error || "Audio playback failed");
        return playback;
      }

      throw new Error(result.message || "Gnani TTS returned no audio.");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "TTS failed";
      this.config?.onError?.(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      this.isSpeaking = false;
      if (!this.isRecording) this.setState("ready");
    }
  }

  /**
   * Play audio blob through audio element
   */
  private async playAudioBlob(audioBlob: Blob): Promise<TTSResult> {
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.preload = "auto";
      audio.playbackRate = 1;
      audio.volume = 1;
      this.currentAudio = audio;

      const cleanup = () => {
        URL.revokeObjectURL(audioUrl);
        audio.onended = null;
        audio.onerror = null;
        audio.onplay = null;
        if (this.currentAudio === audio) this.currentAudio = null;
        if (this.currentAudioCancel === cancel) this.currentAudioCancel = null;
      };
      const cancel = () => {
        cleanup();
        resolve({ success: false, error: "Audio playback cancelled" });
      };
      this.currentAudioCancel = cancel;

      audio.onended = () => {
        console.info("[voice] TTS playback completed", {
          milliseconds: Math.round(performance.now() - startedAt),
          duration: audio.duration,
        });
        cleanup();
        resolve({ success: true });
      };
      
      audio.onerror = () => {
        cleanup();
        resolve({ success: false, error: "Audio playback failed" });
      };

      audio.onplay = () => {
        console.info("[voice] TTS playback started", {
          milliseconds: Math.round(performance.now() - startedAt),
          duration: audio.duration,
        });
      };
      audio.play().catch(() => {
        cleanup();
        resolve({ success: false, error: "Audio play rejected (user interaction required)" });
      });
    });
  }

  /**
   * Cancel any ongoing speech
   */
  async cancelSpeech(): Promise<void> {
    cancelBrowserSpeech();
    const audio = this.currentAudio;
    if (audio) {
      this.currentAudioCancel?.();
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      if (this.currentAudio === audio) this.currentAudio = null;
    }
    this.currentAudioCancel = null;
    this.isSpeaking = false;
  }

  /**
   * Start audio level monitoring for visualization
   */
  private startLevelMonitoring(): void {
    if (!this.analyser) return;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.levelCheckInterval = setInterval(() => {
      if (!this.analyser || !this.isRecording) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;
      const level = Math.min(1, average / 128); // Normalize 0-1
      
      this.config?.onAudioLevel?.(level);
    }, 100);
  }

  private stopLevelMonitoring(): void {
    if (this.levelCheckInterval) {
      clearInterval(this.levelCheckInterval);
      this.levelCheckInterval = null;
    }
  }

  /**
   * Export recorded audio as WAV blob
   */
  private getRecorderMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  private stopRecorderAndBuildBlob(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder) throw new Error("Recorder is not initialized");
    if (recorder.state === "inactive") {
      const blob = new Blob(this.recordedChunks, { type: recorder.mimeType || "audio/webm" });
      this.recordedChunks = [];
      this.recorder = null;
      return Promise.resolve(blob);
    }

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: recorder.mimeType || "audio/webm" });
        this.recordedChunks = [];
        this.recorder = null;
        if (blob.size === 0) reject(new Error("No microphone audio was captured"));
        else void this.convertToWav(blob).then(resolve).catch(reject);
      };
      recorder.onerror = () => reject(new Error("Microphone recording failed"));
      recorder.stop();
    });
  }

  private async convertToWav(blob: Blob): Promise<Blob> {
    if (blob.type === "audio/wav") return blob;
    if (!this.audioContext) throw new Error("Audio context is unavailable for recording conversion");
    const bytes = await blob.arrayBuffer();
    const decoded = await this.audioContext.decodeAudioData(bytes.slice(0));
    if (decoded.duration > 30) throw new Error("Please keep each voice message under 30 seconds.");
    const targetRate = 16000;
    const frameCount = Math.max(1, Math.round(decoded.duration * targetRate));
    const mono = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i += 1) {
      const sourceIndex = Math.min(decoded.length - 1, Math.round((i / targetRate) * decoded.sampleRate));
      let sample = 0;
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        sample += decoded.getChannelData(channel)[sourceIndex] || 0;
      }
      mono[i] = sample / decoded.numberOfChannels;
    }

    const buffer = new ArrayBuffer(44 + mono.length * 2);
    const view = new DataView(buffer);
    this.writeWavString(view, 0, "RIFF");
    view.setUint32(4, 36 + mono.length * 2, true);
    this.writeWavString(view, 8, "WAVE");
    this.writeWavString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    this.writeWavString(view, 36, "data");
    view.setUint32(40, mono.length * 2, true);
    for (let i = 0; i < mono.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, mono[i]));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  private writeWavString(view: DataView, offset: number, value: string): void {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  }

  /**
   * Get current engine state
   */
  getState(): AudioEngineState {
    return this.state;
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Check if currently speaking
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * Check if processing STT
   */
  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current turn ID
   */
  getCurrentTurnId(): string | null {
    return this.currentTurnId;
  }

  /**
   * Get available input devices
   */
  async getInputDevices(): Promise<MediaDeviceInfo[]> {
    return this.enumerateDevices();
  }

  /**
   * Set state and notify listeners
   */
  private setState(newState: AudioEngineState): void {
    this.state = newState;
    this.config?.onStateChange?.(newState);
  }

  /**
   * Complete cleanup - call when destroying the engine
   */
  destroy(): void {
    this.isDestroyed = true;
    
    // Stop any ongoing operations
    if (this.isRecording) {
      this.cancelRecording();
    }
    this.cancelSpeech();
    
    // Cleanup audio resources
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null;
    if (this.input) this.input.disconnect();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
    }
    
    this.stopLevelMonitoring();
    this.recordedChunks = [];
    this.config = null;
    this.currentTurnId = null;
  }

  // Prevent cloning
  private clone() { throw new Error("Cannot clone singleton"); }
}

// Export singleton instance getter
export const audioEngine = SharedAudioEngine.getInstance();

// React hook for using the shared audio engine
export function useAudioEngine(config: AudioEngineConfig) {
  const engine = SharedAudioEngine.getInstance();
  
  // Initialize with config on mount
  // Note: In React, you'd typically use useEffect for this
  // This is a simple wrapper for non-React usage or initialization
  
  return {
    initialize: engine.initialize.bind(engine),
    startRecording: engine.startRecording.bind(engine),
    stopRecording: engine.stopRecording.bind(engine),
    cancelRecording: engine.cancelRecording.bind(engine),
    transcribe: engine.transcribe.bind(engine),
    speak: engine.speak.bind(engine),
    cancelSpeech: engine.cancelSpeech.bind(engine),
    getState: engine.getState.bind(engine),
    getIsRecording: engine.getIsRecording.bind(engine),
    getIsSpeaking: engine.getIsSpeaking.bind(engine),
    getInputDevices: engine.getInputDevices.bind(engine),
    setSelectedDevice: engine.setSelectedDevice.bind(engine),
    getSelectedDevice: engine.getSelectedDevice.bind(engine),
    destroy: engine.destroy.bind(engine),
  };
}

export default SharedAudioEngine;