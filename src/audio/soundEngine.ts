class SoundEngine {
  private ctx: AudioContext | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineNoiseNode: AudioBufferSourceNode | null = null;
  private engineNoiseGain: GainNode | null = null;

  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private plasmaGain: GainNode | null = null;
  private plasmaFilter: BiquadFilterNode | null = null;

  private isMuted: boolean = false;
  private initialized: boolean = false;

  public init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master setup
      const master = this.ctx.createGain();
      master.gain.value = 0.8;
      master.connect(this.ctx.destination);

      // 1. Rocket Engine Synthesis
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02; // Brown/pink noise
        lastOut = output[i];
        output[i] *= 3.5;
      }

      this.engineNoiseNode = this.ctx.createBufferSource();
      this.engineNoiseNode.buffer = noiseBuffer;
      this.engineNoiseNode.loop = true;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 180;

      this.engineNoiseGain = this.ctx.createGain();
      this.engineNoiseGain.gain.value = 0;

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;

      this.engineNoiseNode.connect(this.engineFilter);
      this.engineFilter.connect(this.engineNoiseGain);
      this.engineNoiseGain.connect(master);

      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(master);

      this.engineNoiseNode.start();
      this.engineOsc.start();

      // 2. Aerodynamic Wind Noise
      const windBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const windData = windBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        windData[i] = Math.random() * 2 - 1;
      }
      const windSource = this.ctx.createBufferSource();
      windSource.buffer = windBuffer;
      windSource.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 400;
      this.windFilter.Q.value = 1.2;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;

      windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(master);
      windSource.start();

      // 3. Re-entry Plasma Roar
      this.plasmaFilter = this.ctx.createBiquadFilter();
      this.plasmaFilter.type = 'highpass';
      this.plasmaFilter.frequency.value = 600;

      this.plasmaGain = this.ctx.createGain();
      this.plasmaGain.gain.value = 0;

      const plasmaSource = this.ctx.createBufferSource();
      plasmaSource.buffer = windBuffer;
      plasmaSource.loop = true;
      plasmaSource.connect(this.plasmaFilter);
      this.plasmaFilter.connect(this.plasmaGain);
      this.plasmaGain.connect(master);
      plasmaSource.start();

      this.initialized = true;
    } catch {
      // Ignore audio context block if user hasn't interacted
    }
  }

  public updateTelemetry(throttle: number, hasThrust: boolean, dynamicPressure: number, heatFlux: number) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;

    // Engine sound
    if (this.engineGain && this.engineNoiseGain && this.engineFilter) {
      if (hasThrust && throttle > 0.01) {
        const targetGain = Math.min(1.0, throttle * 0.45);
        this.engineNoiseGain.gain.setTargetAtTime(targetGain, t, 0.05);
        this.engineGain.gain.setTargetAtTime(targetGain * 0.2, t, 0.05);
        this.engineFilter.frequency.setTargetAtTime(120 + throttle * 600, t, 0.08);
      } else {
        this.engineNoiseGain.gain.setTargetAtTime(0, t, 0.05);
        this.engineGain.gain.setTargetAtTime(0, t, 0.05);
      }
    }

    // Aerodynamic Wind
    if (this.windGain && this.windFilter) {
      const windVol = Math.min(0.6, dynamicPressure * 0.08);
      this.windGain.gain.setTargetAtTime(windVol, t, 0.1);
      this.windFilter.frequency.setTargetAtTime(300 + Math.min(1200, dynamicPressure * 80), t, 0.1);
    }

    // Re-entry Plasma
    if (this.plasmaGain) {
      const plasmaVol = Math.min(0.7, heatFlux * 0.5);
      this.plasmaGain.gain.setTargetAtTime(plasmaVol, t, 0.08);
    }
  }

  public playLegoSnapSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      // High-tech snappy plastic magnetic click
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, t);
      filter.Q.setValueAtTime(3.0, t);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(350, t + 0.04);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.05);

      // Subtle low pop for solid body feel
      const lowOsc = this.ctx.createOscillator();
      const lowGain = this.ctx.createGain();
      lowOsc.type = 'sine';
      lowOsc.frequency.setValueAtTime(280, t);
      lowOsc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

      lowGain.gain.setValueAtTime(0.25, t);
      lowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      lowOsc.connect(lowGain);
      lowGain.connect(this.ctx.destination);
      lowOsc.start(t);
      lowOsc.stop(t + 0.065);
    } catch {
      // Audio safeguard
    }
  }

  public playLegoAttachSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      // Solid mechanical locking "clack"
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(520, t);
      osc1.frequency.exponentialRampToValueAtTime(140, t + 0.08);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1800, t);
      osc2.frequency.exponentialRampToValueAtTime(400, t + 0.04);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.09);
      osc2.stop(t + 0.09);
    } catch {
      // Safeguard
    }
  }

  public playLegoDetachSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      // Slight upward unlatch pop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(650, t + 0.06);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    } catch {
      // Safeguard
    }
  }

  public playRotateClickSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.03);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    } catch {
      // Safeguard
    }
  }

  public playStageSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.3);
    } catch {
      // Audio error safe guard
    }
  }

  public playRcsSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    } catch {
      // Safe guard
    }
  }

  public playParachuteSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.4);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    } catch {
      // Safe guard
    }
  }

  public playExplosionSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.exponentialRampToValueAtTime(20, t + 0.8);

      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.9);
    } catch {
      // Safe guard
    }
  }

  public playBigExplosionSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      
      // 1. Low thunderous sub-bass boom
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(18, t + 1.8);
      gain.gain.setValueAtTime(1.0, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 2.0);

      // 2. High noise blast
      const bufferSize = this.ctx.sampleRate * 2.0;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(800, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(80, t + 1.8);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noiseSource.start(t);
    } catch {
      // Safe guard
    }
  }

  public playKlaxonAlarm() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      // Dual-tone urgent alert klaxon (e.g. 520Hz & 840Hz)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540, t);
      osc.frequency.setValueAtTime(820, t + 0.18);
      osc.frequency.setValueAtTime(540, t + 0.36);
      osc.frequency.setValueAtTime(820, t + 0.54);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.73);
    } catch {
      // Safe guard
    }
  }

  public playLowFuelBeep() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      // High-low dual-tone alert chime (880Hz to 660Hz)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(660, t + 0.12);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    } catch {
      // Safe guard
    }
  }

  public playVictoryFanfare() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch {
      // Safe guard
    }
  }

  public playCountdownBeep(isFinal: boolean = false) {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFinal ? 1760 : 880, t); // Apollo Quindar style beep
      gain.gain.setValueAtTime(isFinal ? 0.35 : 0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (isFinal ? 0.35 : 0.12));

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + (isFinal ? 0.36 : 0.13));
    } catch {
      // Safeguard
    }
  }

  public playCryoVentSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      // High-pressure white noise hiss with bandpass
      const bufferSize = this.ctx.sampleRate * 1.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, t);
      filter.Q.setValueAtTime(1.5, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(t);
    } catch {
      // Safeguard
    }
  }

  public playClampReleaseSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      // Heavy mechanical pop and metal clatter
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch {
      // Safeguard
    }
  }

  public playMetalCreakSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      // Strained metal groaning frequency modulation
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.linearRampToValueAtTime(140, t + 0.15);
      osc.frequency.linearRampToValueAtTime(75, t + 0.35);

      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.42);
    } catch {
      // Safeguard
    }
  }

  public playAirBrakeSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.4;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.Q.setValueAtTime(2.0, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(t);
    } catch {
      // Safeguard
    }
  }

  public playVehicleHornSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      // High two-tone polite escort horn
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(440, t); // A4
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(554.37, t); // C#5

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.setValueAtTime(0.25, t + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.3);
      osc2.stop(t + 0.3);
    } catch {
      // Safeguard
    }
  }

  public playDelugeSound() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(t);
    } catch {
      // Safeguard
    }
  }

  public speakMissionControl(phrase: string) {
    if (this.isMuted) return;
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        // Cancel any pending speech to stay in lockstep with countdown
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.rate = 1.15;
        utterance.pitch = 0.95;
        utterance.volume = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // Voice fallback
    }
  }

  public toggleMute(): boolean {
    return this.setMuted(!this.isMuted);
  }

  public setMuted(muted: boolean): boolean {
    this.isMuted = muted;
    if (this.isMuted && this.engineGain && this.windGain && this.plasmaGain) {
      const t = this.ctx?.currentTime || 0;
      this.engineNoiseGain?.gain.setValueAtTime(0, t);
      this.engineGain?.gain.setValueAtTime(0, t);
      this.windGain.gain.setValueAtTime(0, t);
      this.plasmaGain.gain.setValueAtTime(0, t);
    }
    return this.isMuted;
  }

  public getMuted() {
    return this.isMuted;
  }
}

export const soundEngine = new SoundEngine();
