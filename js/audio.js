class CampusAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastPlayed = {};
  }

  ensureContext() {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    return this.muted;
  }

  canPlay(tag, minGapMs = 60) {
    const now = Date.now();
    const prev = this.lastPlayed[tag] || 0;
    if (now - prev < minGapMs) return false;
    this.lastPlayed[tag] = now;
    return true;
  }

  playTone(freqStart, freqEnd, durSec, type = 'sine', gainVal = 0.08, delay = 0) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + durSec);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durSec + 0.02);
  }

  playPop() {
    if (this.muted || !this.canPlay('pop', 55)) return;
    this.playTone(520, 740, 0.09, 'triangle', 0.07);
  }

  playServe() {
    if (this.muted || !this.canPlay('serve', 55)) return;
    this.playTone(480, 680, 0.08, 'triangle', 0.07, 0);
    this.playTone(720, 920, 0.1, 'sine', 0.06, 0.05);
  }

  playBuild(variant) {
    if (this.muted || !this.canPlay('build', 80)) return;
    // Subtle foundation thump + variant harmonic chime
    this.playTone(135, 68, 0.14, 'sine', 0.09, 0);
    if (variant === 'xhcn') {
      this.playTone(523.25, 523.25, 0.15, 'triangle', 0.08, 0.02);
      this.playTone(659.25, 659.25, 0.17, 'triangle', 0.08, 0.08);
      this.playTone(783.99, 783.99, 0.2, 'sine', 0.085, 0.14);
      this.playTone(1046.5, 1046.5, 0.28, 'sine', 0.075, 0.2);
    } else if (variant === 'private') {
      this.playTone(440, 587, 0.14, 'sine', 0.07, 0.02);
      this.playTone(587, 523, 0.18, 'triangle', 0.065, 0.1);
    } else {
      this.playTone(349.23, 392, 0.16, 'triangle', 0.07, 0.02);
      this.playTone(440, 440, 0.18, 'sine', 0.06, 0.09);
    }
  }

  playUnlockCharacteristic() {
    if (this.muted || !this.canPlay('unlockChar', 180)) return;
    const chime = [587.33, 783.99, 987.77, 1174.66];
    chime.forEach((f, idx) => {
      this.playTone(f, f, 0.22, 'sine', 0.065, 0.12 + idx * 0.065);
    });
  }

  playLocked() {
    if (this.muted || !this.canPlay('locked', 150)) return;
    this.playTone(190, 140, 0.12, 'sawtooth', 0.05, 0);
  }

  playAlert() {
    if (this.muted || !this.canPlay('alert', 300)) return;
    this.playTone(660, 660, 0.12, 'triangle', 0.07, 0);
    this.playTone(880, 880, 0.18, 'triangle', 0.07, 0.13);
  }

  playSuccess() {
    if (this.muted || !this.canPlay('success', 300)) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone(f, f, 0.24, 'triangle', 0.08, idx * 0.08);
    });
  }
}

export const audio = new CampusAudio();
