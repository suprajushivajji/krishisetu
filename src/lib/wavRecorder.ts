/**
 * Audio Recording & WAV Conversion Helper for Browser
 * 
 * Gnani Prisma v2.5 requires valid WAV, MP3, OGG, or AAC audio.
 * Standard Chrome/Edge MediaRecorder outputs audio/webm, which causes Gnani 400.
 * This utility records via AudioContext and encodes PCM 16kHz Mono WAV.
 */

export class WavRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private audioData: Float32Array[] = [];
  private sampleRate = 16000;

  public async start(): Promise<void> {
    this.audioData = [];
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: this.sampleRate });
    await this.audioContext.resume();

    this.input = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      this.audioData.push(new Float32Array(channelData));
    };

    this.input.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  public async stop(): Promise<Blob> {
    if (this.processor && this.input) {
      this.input.disconnect();
      this.processor.disconnect();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }

    return this.exportWAV();
  }

  private exportWAV(): Blob {
    let totalLength = 0;
    for (const chunk of this.audioData) {
      totalLength += chunk.length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.audioData) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    if (merged.length === 0) {
      throw new Error("No microphone audio was captured. Hold the microphone button while speaking, then stop.");
    }

    // Convert Float32 to 16-bit PCM
    const buffer = new ArrayBuffer(44 + merged.length * 2);
    const view = new DataView(buffer);

    // RIFF identifier
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + merged.length * 2, true);
    this.writeString(view, 8, "WAVE");

    // Format chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // Linear PCM
    view.setUint16(22, 1, true); // Mono channel
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample

    // Data chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, merged.length * 2, true);

    // Write PCM samples
    let index = 44;
    for (let i = 0; i < merged.length; i++) {
      const s = Math.max(-1, Math.min(1, merged[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      index += 2;
    }

    return new Blob([view], { type: "audio/wav" });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
