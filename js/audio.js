// Mở khóa âm thanh iOS: đặt audioSession 'playback' (iOS 17+) để TTS +
// Web Audio phát được cả khi công tắc im lặng đang bật.
function setAudioSessionPlayback() {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && nav.audioSession && nav.audioSession.type !== 'playback') {
      nav.audioSession.type = 'playback';
    }
  } catch (_) { /* iOS cũ / trình duyệt không hỗ trợ: bỏ qua */ }
}

export class AudioManager {
  constructor({ onSpeakStateChange, onSpeechComplete } = {}) {
    this.ttsEnabled = true;
    this.bgmEnabled = true;
    this.paused = false;
    this.isSpeaking = false;
    this.lastSpokenText = '';
    this.onSpeakStateChange = onSpeakStateChange || (() => {});
    this.onSpeechComplete = onSpeechComplete || (() => {});

    this.ctx = null;
    this.bgmGain = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.fallbackSpeakTimer = null;
    this.speechQueue = [];
    this.viVoice = null;

    this._initVoices();
  }

  _initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices() || [];
      this.viVoice =
        voices.find((v) => /vi[-_]?VN/i.test(v.lang) && /female|linh|hoai|my|google/i.test(v.name)) ||
        voices.find((v) => /^vi/i.test(v.lang)) ||
        null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.08;
      this.bgmGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Original copyright-free upbeat boutique lo-fi/marimba groove via Web Audio API.
   */
  startBgm() {
    if (!this.bgmEnabled || this.paused) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.bgmTimer) return;

    // Original chord progression: Cmaj7 -> Am7 -> Fmaj7 -> G6 (108 BPM eighth notes)
    const chords = [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 329.63],
    ];
    const melody = [
      523.25, 0, 659.25, 587.33, 523.25, 0, 392.0, 0,
      440.0, 0, 523.25, 659.25, 587.33, 0, 523.25, 0,
      440.0, 523.25, 659.25, 0, 587.33, 523.25, 440.0, 0,
      493.88, 0, 587.33, 659.25, 783.99, 0, 659.25, 0,
    ];

    const stepMs = 278;
    const playStep = () => {
      if (!this.bgmEnabled || this.paused || !this.ctx) return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep % 32;
      const chordIdx = Math.floor(step / 8) % chords.length;

      // Soft warm chord pad on downbeat of each bar
      if (step % 8 === 0) {
        for (const freq of chords[chordIdx]) {
          this._playNote(freq, now, 1.5, 'triangle', 0.14);
        }
      }

      // Gentle bass pluck
      if (step % 4 === 0) {
        this._playNote(chords[chordIdx][0] / 2, now, 0.35, 'sine', 0.24);
      }

      // Original cheerful marimba melody
      const melFreq = melody[step];
      if (melFreq > 0) {
        this._playNote(melFreq, now, 0.24, 'sine', 0.18);
      }

      // Soft rhythmic brush click on off-beats
      if (step % 2 === 1) {
        this._playSoftClick(now, step % 4 === 3 ? 0.06 : 0.03);
      }

      this.bgmStep += 1;
    };

    playStep();
    this.bgmTimer = setInterval(playStep, stepMs);
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  _playNote(freq, startTime, duration, type = 'sine', gainPeak = 0.15) {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  }

  _playSoftClick(startTime, gainPeak = 0.04) {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100, startTime);
    osc.frequency.exponentialRampToValueAtTime(320, startTime + 0.04);
    g.gain.setValueAtTime(gainPeak, startTime);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);
    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(startTime);
    osc.stop(startTime + 0.05);
  }

  playSfx(kind = 'cart') {
    if (this.paused) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.16;
    out.connect(ctx.destination);

    const tone = (freq, offset, dur, type = 'sine') => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + offset);
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.exponentialRampToValueAtTime(0.28, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
      osc.connect(g);
      g.connect(out);
      osc.start(now + offset);
      osc.stop(now + offset + dur + 0.02);
    };

    if (kind === 'cart') {
      tone(587.33, 0, 0.12);
      tone(880.0, 0.08, 0.18);
    } else if (kind === 'gift') {
      tone(659.25, 0, 0.12);
      tone(783.99, 0.08, 0.12);
      tone(1046.5, 0.16, 0.25);
    } else if (kind === 'checkout') {
      tone(523.25, 0, 0.14);
      tone(659.25, 0.1, 0.14);
      tone(783.99, 0.2, 0.14);
      tone(1046.5, 0.3, 0.38);
    } else if (kind === 'join') {
      tone(740, 0, 0.09);
      tone(987.77, 0.06, 0.13);
    }
  }

  // Mồi TTS + Web Audio trên iOS: gọi 1 lần lúc tải trang và ở lần chạm đầu.
  unlockIosAudio() {
    setAudioSessionPlayback();
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
        const Ctor = window.SpeechSynthesisUtterance;
        if (typeof Ctor === 'function') {
          const u = new Ctor('.');
          u.lang = 'vi-VN';
          u.volume = 0; // Mồi im lặng: chỉ để iOS mở khóa TTS, không phát ra tiếng.
          window.speechSynthesis.speak(u);
        }
      }
    } catch (_) { /* bỏ qua */ }
    this.ensureContext();
  }

  setTtsEnabled(enabled) {
    this.ttsEnabled = Boolean(enabled);
    if (!this.ttsEnabled) {
      this.stopSpeaking();
    }
  }

  setBgmEnabled(enabled) {
    this.bgmEnabled = Boolean(enabled);
    if (this.bgmEnabled && !this.paused) {
      this.startBgm();
    } else {
      this.stopBgm();
    }
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.paused) {
      this.stopBgm();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.pause();
        } catch {}
      }
    } else {
      if (this.bgmEnabled) this.startBgm();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.resume();
        } catch {}
      }
    }
  }

  stopSpeaking() {
    this.speechQueue = [];
    if (this.fallbackSpeakTimer) {
      clearTimeout(this.fallbackSpeakTimer);
      this.fallbackSpeakTimer = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakStateChange(false);
    }
  }

  /**
   * Speak Vietnamese text via Web Speech API.
   * When interrupt=false, queues behind the currently speaking sentence
   * so viewer welcomes never interrupt an active product pitch.
   */
  speak(text, options = {}) {
    const clean = String(text || '').trim();
    if (!clean) return;

    const { interrupt = true, onStart = null, onEnd = null, isWelcome = false } = options;
    this.lastSpokenText = clean;

    if (this.paused) return;

    if (!interrupt && this.isSpeaking) {
      this.speechQueue.push({ text: clean, onStart, onEnd, isWelcome });
      return;
    }

    if (interrupt) {
      this.stopSpeaking();
    }

    this._dispatchSpeech({ text: clean, onStart, onEnd, isWelcome });
  }

  _dispatchSpeech(item) {
    const { text, onStart, onEnd } = item;
    this.lastSpokenText = text;
    this.isSpeaking = true;
    this.onSpeakStateChange(true);
    if (onStart) onStart(text);

    const finish = () => {
      if (this.fallbackSpeakTimer) {
        clearTimeout(this.fallbackSpeakTimer);
        this.fallbackSpeakTimer = null;
      }
      this.isSpeaking = false;
      this.onSpeakStateChange(false);
      if (onEnd) onEnd(text);

      if (this.speechQueue.length > 0 && !this.paused) {
        const next = this.speechQueue.shift();
        this._dispatchSpeech(next);
      } else {
        this.onSpeechComplete();
      }
    };

    // Estimate speaking duration for safety fallback / headless lip-sync
    const estimatedMs = Math.min(5200, Math.max(1700, text.length * 40));

    if (!this.ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.fallbackSpeakTimer = setTimeout(finish, Math.min(2400, estimatedMs));
      return;
    }

    let finished = false;
    const safeFinish = () => {
      if (finished) return;
      finished = true;
      finish();
    };

    let speechStartedAt = Date.now();
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'vi-VN';
      utter.rate = 1.06;
      utter.pitch = 1.08;
      if (this.viVoice) utter.voice = this.viVoice;
      utter.onstart = () => {
        speechStartedAt = Date.now();
      };
      utter.onend = safeFinish;
      utter.onerror = () => {
        // If browser has no speech daemon and errors instantly (<250ms),
        // let fallbackSpeakTimer keep lip-sync alive naturally instead of snapping mouth shut.
        if (Date.now() - speechStartedAt >= 250) {
          safeFinish();
        }
      };
      setAudioSessionPlayback(); // Giữ kênh 'playback' mỗi lần đọc (iOS 17+).
      window.speechSynthesis.speak(utter);
    } catch {
      // Fallback handled by timer below
    }

    this.fallbackSpeakTimer = setTimeout(safeFinish, Math.min(3400, estimatedMs));
  }

  repeatLast() {
    if (!this.lastSpokenText) return;
    this.speak(this.lastSpokenText, { interrupt: true });
  }
}
