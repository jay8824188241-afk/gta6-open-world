// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, police siren, gunshots, pickups, UI blips and mission jingles.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    audio.ctx = new Ctor();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);

    // Looping engine drone, pitch follows the player's speed.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0.0;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineOsc.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();

    // Two-tone police siren, toggled by a timer while wanted.
    audio.sirenOsc = audio.ctx.createOscillator();
    audio.sirenOsc.type = 'triangle';
    audio.sirenOsc.frequency.value = 660;
    audio.sirenGain = audio.ctx.createGain();
    audio.sirenGain.gain.value = 0.0;
    audio.sirenOsc.connect(audio.sirenGain);
    audio.sirenGain.connect(audio.master);
    audio.sirenOsc.start();
  };

  audio.setEngine = function setEngine(speedRatio, driving) {
    if (!audio.ctx || audio.muted) return;
    const target = driving ? 0.045 + speedRatio * 0.06 : 0.0;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
    audio.engineOsc.frequency.setTargetAtTime(
      50 + speedRatio * 130, audio.ctx.currentTime, 0.08,
    );
  };

  audio.setSiren = function setSiren(on, dt) {
    if (!audio.ctx) return;
    if (!on) {
      audio.sirenGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
      return;
    }
    audio.sirenTimer += dt;
    if (audio.sirenTimer > 0.45) {
      audio.sirenTimer = 0;
      audio.sirenHigh = !audio.sirenHigh;
      audio.sirenOsc.frequency.setTargetAtTime(
        audio.sirenHigh ? 880 : 660, audio.ctx.currentTime, 0.02,
      );
    }
    audio.sirenGain.gain.setTargetAtTime(
      audio.muted ? 0 : 0.035, audio.ctx.currentTime, 0.1,
    );
  };

  audio.blip = function blip(freq, dur, type, vol) {
    if (!audio.ctx || audio.muted) return;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.12, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start();
    osc.stop(audio.ctx.currentTime + dur);
  };

  audio.noise = function noise(dur, vol, lowpass) {
    if (!audio.ctx || audio.muted) return;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1800;
    const gain = audio.ctx.createGain();
    gain.gain.value = vol || 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
  };

  audio.shot = function shot() {
    audio.noise(0.12, 0.3, 2400);
    audio.blip(180, 0.08, 'square', 0.1);
  };

  audio.crash = function crash() {
    audio.noise(0.25, 0.35, 500);
  };

  audio.pickup = function pickup() {
    audio.blip(660, 0.09, 'sine', 0.16);
    setTimeout(() => audio.blip(990, 0.12, 'sine', 0.16), 70);
  };

  audio.jingle = function jingle() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => audio.blip(freq, 0.16, 'triangle', 0.18), i * 110);
    });
  };

  audio.fail = function fail() {
    [392, 330, 262].forEach((freq, i) => {
      setTimeout(() => audio.blip(freq, 0.2, 'sawtooth', 0.12), i * 140);
    });
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  return audio;
}
