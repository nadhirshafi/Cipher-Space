/**
 * Procedural Space Audio Engine using Web Audio API.
 * Generates cold-gas thruster hiss, deep space ambient drone,
 * and helmet life-support hum without requiring any external audio files.
 */

class SpaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;

    // Audio nodes
    this.masterGain = null;
    this.ambientGain = null;
    this.thrusterNoiseNode = null;
    this.thrusterGain = null;
    this.thrusterFilter = null;
    this.isThrusterFiring = false;
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Start background ambient drone
      this._createAmbientDrone();

      // Prepare thruster synth
      this._setupThrusterSynth();

      this.initialized = true;

      // Resume context as soon as user gestures
      if (this.ctx.state === 'suspended') {
        const resumeCtx = () => {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
          window.removeEventListener('pointerdown', resumeCtx);
          window.removeEventListener('keydown', resumeCtx);
        };
        window.addEventListener('pointerdown', resumeCtx, { once: true });
        window.addEventListener('keydown', resumeCtx, { once: true });
      }
    } catch (e) {
      console.warn('Web Audio not supported or failed to initialize', e);
    }
  }

  resume() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _createAmbientDrone() {
    if (!this.ctx) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    this.ambientGain.connect(this.masterGain);

    // Deep cosmic sub-bass rumble (50 Hz)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(48, this.ctx.currentTime);

    // Detuned sub-bass (52 Hz) for natural acoustic beating
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(51.5, this.ctx.currentTime);

    // Low-pass filter to keep it deep and atmospheric
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, this.ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(this.ambientGain);

    osc1.start();
    osc2.start();

    // Helmet ventilation hiss (soft pink-filtered noise)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const ventFilter = this.ctx.createBiquadFilter();
    ventFilter.type = 'bandpass';
    ventFilter.frequency.setValueAtTime(420, this.ctx.currentTime);
    ventFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    const ventGain = this.ctx.createGain();
    ventGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    whiteNoise.connect(ventFilter);
    ventFilter.connect(ventGain);
    ventGain.connect(this.masterGain);

    whiteNoise.start();
  }

  _setupThrusterSynth() {
    if (!this.ctx) return;

    // Thruster noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.thrusterNoiseNode = this.ctx.createBufferSource();
    this.thrusterNoiseNode.buffer = noiseBuffer;
    this.thrusterNoiseNode.loop = true;

    this.thrusterFilter = this.ctx.createBiquadFilter();
    this.thrusterFilter.type = 'bandpass';
    this.thrusterFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    this.thrusterFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.thrusterGain = this.ctx.createGain();
    this.thrusterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    this.thrusterNoiseNode.connect(this.thrusterFilter);
    this.thrusterFilter.connect(this.thrusterGain);
    this.thrusterGain.connect(this.masterGain);

    this.thrusterNoiseNode.start();
  }

  setThrusterActive(active) {
    if (!this.initialized || !this.ctx || !this.thrusterGain) return;

    const now = this.ctx.currentTime;
    if (active) {
      if (!this.isThrusterFiring) {
        this.isThrusterFiring = true;
        // Sudden cold gas burst puff
        this.thrusterGain.gain.cancelScheduledValues(now);
        this.thrusterGain.gain.setValueAtTime(this.thrusterGain.gain.value, now);
        this.thrusterGain.gain.linearRampToValueAtTime(0.28, now + 0.05);

        // Slight resonance chirp
        this.thrusterFilter.frequency.setValueAtTime(950, now);
        this.thrusterFilter.frequency.exponentialRampToValueAtTime(750, now + 0.15);
      }
    } else {
      if (this.isThrusterFiring) {
        this.isThrusterFiring = false;
        // Smooth release cutoff
        this.thrusterGain.gain.cancelScheduledValues(now);
        this.thrusterGain.gain.setValueAtTime(this.thrusterGain.gain.value, now);
        this.thrusterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      }
    }
  }

  _canPlay() {
    if (!this.initialized || !this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      return false;
    }
    return !this.isMuted;
  }

  playHydraulicLock() {
    if (!this._canPlay()) return;

    const now = this.ctx.currentTime;

    // Metallic heavy clunk
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);

    // Pneumatic air hiss puff
    const bufSize = Math.floor(this.ctx.sampleRate * 0.2);
    const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(3.0, now);

    const pneuGain = this.ctx.createGain();
    pneuGain.gain.setValueAtTime(0.2, now + 0.05);
    pneuGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noise.connect(filter);
    filter.connect(pneuGain);
    pneuGain.connect(this.masterGain);

    noise.start(now + 0.05);
    noise.stop(now + 0.22);
  }

  playRatchetClick() {
    if (!this._canPlay()) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400 + Math.random() * 300, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.025);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  playServoSound() {
    if (!this._canPlay()) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.06);
    osc.frequency.linearRampToValueAtTime(380, now + 0.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  playHoverPing() {
    if (!this._canPlay()) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playAvionicsLaunchSound() {
    if (!this._canPlay()) return;

    const now = this.ctx.currentTime;

    // Power up whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.8);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.25);

    // Followed by celebratory fanfare
    setTimeout(() => {
      this.playMissionSuccess();
    }, 700);
  }

  playMissionSuccess() {
    if (!this._canPlay()) return;

    const now = this.ctx.currentTime;
    // Triumphant rising arpeggio chord (C5, E5, G5, C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.14;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.85);
    });
  }

  playClick() {
    if (!this._canPlay()) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.04);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  toggleMute() {
    if (!this.initialized && !this.ctx) {
      this.init();
    }
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0.0001 : 0.7;
      this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const spaceAudio = new SpaceAudioEngine();

// Ensure audio context resumes on first user click or keypress
if (typeof window !== 'undefined') {
  const resumeOnFirstGesture = () => {
    spaceAudio.resume();
    window.removeEventListener('pointerdown', resumeOnFirstGesture);
    window.removeEventListener('keydown', resumeOnFirstGesture);
  };
  window.addEventListener('pointerdown', resumeOnFirstGesture, { once: true });
  window.addEventListener('keydown', resumeOnFirstGesture, { once: true });
}
