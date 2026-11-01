/**
 * Robust browser Text-to-Speech player.
 *
 * Chrome/Edge silently STOP a single long SpeechSynthesisUtterance after ~15
 * seconds (a long-standing bug), which is why the assistant's replies "cut off"
 * mid-sentence. The reliable workaround is two-fold:
 *
 *   1. Split the text into short sentence chunks and queue one utterance per
 *      chunk, so no single utterance ever reaches the cutoff length.
 *   2. Run a keep-alive timer that periodically pause()/resume() the synthesis
 *      engine while it is speaking, which prevents the engine from stalling.
 *
 * All three voice surfaces (registration agent, voice call, voice assistant)
 * share this so behaviour is identical and the cutoff is fixed everywhere.
 */

export interface BrowserSpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  /** Called if the browser has no usable voice for the language. */
  onNoVoice?: () => void;
}

export interface BrowserSpeakHandle {
  /** Resolves when playback finishes or is cancelled. */
  done: Promise<void>;
  /** Stop playback immediately. */
  cancel: () => void;
}

/** Split into sentence-ish chunks, capped so each stays well under the cutoff. */
export function splitIntoSpeakChunks(text: string, maxLen = 180): string[] {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return [];

  // Break on sentence terminators (Latin + Kannada/Devanagari danda + newlines).
  const rough = normalized
    .split(/(?<=[.!?।॥])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of rough.length ? rough : [normalized]) {
    if (sentence.length <= maxLen) {
      chunks.push(sentence);
      continue;
    }
    // Very long sentence without terminators — split on spaces into windows.
    let start = 0;
    while (start < sentence.length) {
      let end = Math.min(sentence.length, start + maxLen);
      if (end < sentence.length) {
        const spaceIdx = sentence.lastIndexOf(" ", end);
        if (spaceIdx > start) end = spaceIdx;
      }
      chunks.push(sentence.slice(start, end).trim());
      start = end;
    }
  }
  return chunks.filter(Boolean);
}

function pickVoice(synth: SpeechSynthesis, lang: string): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (!voices.length) return null;
  const exact = voices.find((v) => v.lang === lang);
  if (exact) return exact;
  const base = lang.split("-")[0].toLowerCase();
  const partial = voices.find((v) => v.lang.toLowerCase().startsWith(base));
  return partial || null;
}

/**
 * Speak `text` in `lang`, chunked + keep-alive, resolving only when the WHOLE
 * message has been spoken. Cancels any in-progress browser speech first.
 */
export function speakBrowserText(text: string, lang: string, options: BrowserSpeakOptions = {}): BrowserSpeakHandle {
  const cancelFns: Array<() => void> = [];

  // Always cancel whatever is currently speaking so turns never overlap.
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }

  const done = new Promise<void>((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    const chunks = splitIntoSpeakChunks(text);
    if (!chunks.length) {
      resolve();
      return;
    }

    let cancelled = false;
    let finished = false;
    let keepAlive: ReturnType<typeof setInterval> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const voice = pickVoice(synth, lang);
    if (!voice) options.onNoVoice?.();

    const stopKeepAlive = () => {
      if (keepAlive) {
        clearInterval(keepAlive);
        keepAlive = null;
      }
      if (watchdog) {
        clearTimeout(watchdog);
        watchdog = null;
      }
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      stopKeepAlive();
      resolve();
    };

    // Chrome keep-alive: nudge the engine every 8s so it never stalls/cuts off.
    keepAlive = setInterval(() => {
      if (cancelled) return;
      if (synth.speaking && !synth.paused) {
        try {
          synth.pause();
          synth.resume();
        } catch {
          /* ignore */
        }
      }
    }, 8000);

    let index = 0;
    const speakNext = () => {
      if (cancelled) {
        finish();
        return;
      }
      if (index >= chunks.length) {
        finish();
        return;
      }
      const utter = new SpeechSynthesisUtterance(chunks[index]);
      index += 1;
      utter.lang = lang;
      if (voice) utter.voice = voice;
      utter.rate = options.rate ?? 0.95;
      utter.pitch = options.pitch ?? 1.0;
      utter.volume = options.volume ?? 1.0;
      // Generous per-chunk watchdog: if onend never fires (another Chrome bug),
      // advance after long enough that a real chunk could never still be speaking.
      const chunkMs = Math.max(4000, chunks[index - 1].length * 120 + 3000);
      let advanced = false;
      const advance = () => {
        if (advanced || cancelled) return;
        advanced = true;
        speakNext();
      };
      utter.onend = advance;
      utter.onerror = advance;
      setTimeout(advance, chunkMs);
      try {
        synth.speak(utter);
      } catch {
        advance();
      }
    };

    cancelFns.push(() => {
      cancelled = true;
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
      stopKeepAlive();
      finish();
    });

    speakNext();
  });

  return {
    done,
    cancel: () => cancelFns.forEach((fn) => fn()),
  };
}

/** Cancel any current browser speech (safe to call in cleanup paths). */
export function cancelBrowserSpeech(): void {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
