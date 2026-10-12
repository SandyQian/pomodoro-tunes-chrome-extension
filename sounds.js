// Switch sounds, synthesised with Web Audio so no audio files are needed.
// Shared by the popup (preview) and the offscreen page (real switches).

const SOUND_NAMES = {
  chime: "Soft chime",
  bell: "Bell",
  beeps: "Two soft beeps",
  rise: "Rising notes",
  wood: "Wood taps",
  none: "No sound"
};

let pomoAudioCtx = null;

function playSound(name, volume) {
  if (!name || name === "none") return;
  const Ctx = self.AudioContext || self.webkitAudioContext;
  pomoAudioCtx = pomoAudioCtx || new Ctx();
  const ctx = pomoAudioCtx;
  if (ctx.state === "suspended") ctx.resume();

  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume == null ? 0.5 : volume));
  master.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.03;

  // One note: quick fade in, smooth fade out.
  const note = (freq, at, dur, type = "sine", peak = 0.5, attack = 0.012) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(g).connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.05);
  };

  switch (name) {
    case "chime": // two gentle falling notes
      note(1318.5, 0, 0.9, "sine", 0.4);
      note(1046.5, 0.22, 1.2, "sine", 0.4);
      break;
    case "bell": // one note with overtones and a long tail
      note(660, 0, 2.2, "sine", 0.45, 0.005);
      note(1320, 0, 1.4, "sine", 0.18, 0.005);
      note(1986, 0, 0.8, "sine", 0.08, 0.005);
      break;
    case "beeps": // classic timer beep, softened
      note(880, 0, 0.16, "sine", 0.4, 0.02);
      note(880, 0.26, 0.16, "sine", 0.4, 0.02);
      break;
    case "rise": // three notes going up
      note(523.25, 0, 0.5, "triangle", 0.35);
      note(659.25, 0.16, 0.5, "triangle", 0.35);
      note(783.99, 0.32, 0.9, "triangle", 0.35);
      break;
    case "wood": // short marimba-like taps
      note(587.33, 0, 0.18, "triangle", 0.55, 0.003);
      note(880, 0.14, 0.18, "triangle", 0.55, 0.003);
      note(1174.66, 0.28, 0.3, "triangle", 0.5, 0.003);
      break;
  }
}
