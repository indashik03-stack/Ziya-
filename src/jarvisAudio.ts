/**
 * Audio Engine for JARVIS AI HyperOS Control Centre.
 * Implements Web Audio API synthesizer for ambient music, holographic UI sound effects,
 * speech synthesis (English, Hindi, Bengali), and real-time audio analysis for the 3D Orb.
 */

class JarvisAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMusicPlaying = false;
  private musicInterval: number | null = null;
  private currentStep = 0;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.analyser);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.35;
      this.sfxGain.connect(this.analyser);

      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    try {
      this.initContext();
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.045);
    } catch {
      // AudioContext policy
    }
  }

  playToggle(on: boolean) {
    try {
      this.initContext();
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const startFreq = on ? 440 : 660;
      const endFreq = on ? 880 : 330;
      osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.095);
    } catch {
      // Ignored
    }
  }

  playJarvisChime() {
    try {
      this.initContext();
      if (!this.ctx || !this.sfxGain) return;
      const freqs = [587.33, 880, 1174.66]; // D5, A5, D6 futuristic major chord
      freqs.forEach((freq, idx) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = this.ctx.currentTime + idx * 0.07;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.28, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(startTime);
        osc.stop(startTime + 0.46);
      });
    } catch {
      // Ignored
    }
  }

  // Melodic synthesizer for media player
  toggleMusic(): boolean {
    this.initContext();
    if (this.isMusicPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startMusic();
      return true;
    }
  }

  private startMusic() {
    this.isMusicPlaying = true;
    const chords = [
      [220, 261.63, 329.63, 392],    // Am7
      [174.61, 220, 261.63, 329.63], // Fmaj7
      [261.63, 329.63, 392, 493.88], // Cmaj7
      [196, 246.94, 293.66, 349.23]  // G7
    ];
    this.currentStep = 0;

    const playChordStep = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.musicGain) return;
      const chord = chords[this.currentStep % chords.length];
      this.currentStep++;

      chord.forEach((freq, i) => {
        if (!this.ctx || !this.musicGain) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = i === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 1.2);

        gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.09, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 1.45);
      });
    };

    playChordStep();
    this.musicInterval = window.setInterval(playChordStep, 1500);
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private scanGain: GainNode | null = null;
  private scanOscA: OscillatorNode | null = null;
  private scanOscB: OscillatorNode | null = null;
  private scanLfo: OscillatorNode | null = null;
  private scanTimer: number | null = null;
  private isScanActive = false;

  private initScanNodes() {
    if (!this.ctx || !this.analyser) return;
    if (this.scanGain) return;

    this.scanGain = this.ctx.createGain();
    this.scanGain.gain.value = 0.08; // Delicate ambient background level
    this.scanGain.connect(this.analyser);
  }

  // All-time Background Scan Sound (Futuristic HUD radar/sonar pulse & harmonic drone)
  startBackgroundScan() {
    try {
      this.initContext();
      this.initScanNodes();
      if (!this.ctx || !this.scanGain || this.isScanActive) return;

      this.isScanActive = true;
      const t = this.ctx.currentTime;

      // 1. Warm sub harmonic drone (65 Hz)
      this.scanOscA = this.ctx.createOscillator();
      this.scanOscA.type = 'sine';
      this.scanOscA.frequency.setValueAtTime(65.41, t); // C2

      // 2. Resonant bandpass filter with LFO sweep
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(440, t);
      filter.Q.setValueAtTime(4.0, t);

      this.scanLfo = this.ctx.createOscillator();
      this.scanLfo.type = 'sine';
      this.scanLfo.frequency.setValueAtTime(0.2, t); // Slow 5-second breath
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(280, t);
      this.scanLfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // 3. Shimmer overtone (523.25 Hz C5)
      this.scanOscB = this.ctx.createOscillator();
      this.scanOscB.type = 'triangle';
      this.scanOscB.frequency.setValueAtTime(523.25, t);
      const oscBGain = this.ctx.createGain();
      oscBGain.gain.setValueAtTime(0.04, t);

      this.scanOscA.connect(filter);
      this.scanOscB.connect(oscBGain);
      oscBGain.connect(filter);
      filter.connect(this.scanGain);

      this.scanOscA.start(t);
      this.scanOscB.start(t);
      this.scanLfo.start(t);

      // 4. Periodic subtle telemetry sonar chirp every 3.5s
      const playSonarPulse = () => {
        if (!this.isScanActive || !this.ctx || !this.scanGain) return;
        const now = this.ctx.currentTime;
        const chirp = this.ctx.createOscillator();
        const chirpGain = this.ctx.createGain();
        chirp.type = 'sine';
        chirp.frequency.setValueAtTime(1760, now);
        chirp.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        chirpGain.gain.setValueAtTime(0.001, now);
        chirpGain.gain.linearRampToValueAtTime(0.045, now + 0.02);
        chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        chirp.connect(chirpGain);
        chirpGain.connect(this.scanGain);
        chirp.start(now);
        chirp.stop(now + 0.38);
      };

      playSonarPulse();
      this.scanTimer = window.setInterval(playSonarPulse, 3500);
    } catch (e) {
      console.warn('[Audio] Background scan initialization:', e);
    }
  }

  stopBackgroundScan() {
    this.isScanActive = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.scanOscA) {
      try { this.scanOscA.stop(); this.scanOscA.disconnect(); } catch {}
      this.scanOscA = null;
    }
    if (this.scanOscB) {
      try { this.scanOscB.stop(); this.scanOscB.disconnect(); } catch {}
      this.scanOscB = null;
    }
    if (this.scanLfo) {
      try { this.scanLfo.stop(); this.scanLfo.disconnect(); } catch {}
      this.scanLfo = null;
    }
  }

  toggleBackgroundScan(): boolean {
    if (this.isScanActive) {
      this.stopBackgroundScan();
      return false;
    } else {
      this.startBackgroundScan();
      return true;
    }
  }

  isBackgroundScanRunning(): boolean {
    return this.isScanActive;
  }

  setVolume(vol: number) {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)) * 0.35, this.ctx.currentTime);
    }
    if (this.scanGain && this.ctx) {
      this.scanGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)) * 0.08, this.ctx.currentTime);
    }
  }

  getAudioFrequencyData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(32);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  // Zoya AI voice synthesis with expressive feminine & natural acoustic timbre
  speak(text: string, lang: 'en' | 'hi' | 'bn' = 'en') {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1.15; // Refined, melodious Zoya AI tone

    const langCodes: Record<string, string> = {
      en: 'en-US',
      hi: 'hi-IN',
      bn: 'bn-IN'
    };
    utterance.lang = langCodes[lang] || 'en-US';

    // Duck background scan while speaking
    if (this.scanGain && this.ctx && this.isScanActive) {
      this.scanGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
    }

    utterance.onend = () => {
      if (this.scanGain && this.ctx && this.isScanActive) {
        this.scanGain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.3);
      }
    };

    utterance.onerror = () => {
      if (this.scanGain && this.ctx && this.isScanActive) {
        this.scanGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      }
    };

    // Pick best natural female AI voice for ZOYA
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => {
      const isTargetLang = v.lang.startsWith(lang) || v.lang.replace('_', '-').startsWith(langCodes[lang].substring(0, 2));
      const isFemale = /female|woman|zira|samantha|victoria|karen|moira|tessa|fiona|veena|lekha/i.test(v.name);
      return isTargetLang && (isFemale || v.name.includes('Natural') || v.name.includes('Google'));
    }) || voices.find(v => v.lang.startsWith(lang));

    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  }
}

export const jarvisAudio = new JarvisAudioEngine();
