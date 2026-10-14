/* ---- 8-bit sound ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { uiGet } from "../core/config.js";
import { haptic } from "./45-gestures.js";

export var AC, TAPS;

export function tone(f, t0, dur, type, vol) {
  var o = AC.createOscillator(),
    g = AC.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(f, AC.currentTime + t0);
  g.gain.setValueAtTime(vol || 0.06, AC.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + t0 + dur);
  o.connect(g);
  g.connect(AC.destination);
  o.start(AC.currentTime + t0);
  o.stop(AC.currentTime + t0 + dur + 0.02);
}
export function glide(f0, f1, t0, dur, type, vol) {
  var o = AC.createOscillator(),
    g = AC.createGain(),
    at = AC.currentTime + t0;
  o.type = type || "triangle";
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(vol || 0.08, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(AC.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}
export function squish() {
  var t0 = AC.currentTime,
    n = AC.createBufferSource(),
    buf = AC.createBuffer(1, Math.ceil(AC.sampleRate * 0.5), AC.sampleRate),
    d = buf.getChannelData(0);
  for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  var bp = AC.createBiquadFilter(),
    g = AC.createGain(),
    lfo = AC.createOscillator(),
    lg = AC.createGain();
  bp.type = "bandpass";
  bp.Q.value = 3.5;
  bp.frequency.setValueAtTime(1600, t0);
  bp.frequency.exponentialRampToValueAtTime(220, t0 + 0.32);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
  lfo.type = "sine";
  lfo.frequency.value = 26;
  lg.gain.value = 0.2;
  lfo.connect(lg);
  lg.connect(g.gain);
  n.connect(bp);
  bp.connect(g);
  g.connect(AC.destination);
  n.start(t0);
  n.stop(t0 + 0.5);
  lfo.start(t0);
  lfo.stop(t0 + 0.5);
  glide(95, 38, 0, 0.1, "sine", 0.3);
  for (var k = 0; k < 5; k++) {
    var bt = 0.03 + Math.random() * 0.25,
      bf = 260 + Math.random() * 260,
      bd = 0.04 + Math.random() * 0.05;
    glide(bf, bf * 1.9, bt, bd, "sine", 0.12);
  }
}
export function sfx(kind) {
  try {
    if (kind === "base") haptic("medium", true);
    else if (kind === "clear" || kind === "level" || kind === "chime") haptic("success", true);
    else if (kind === "stop") haptic("heavy", true);
    else if (kind === "squish") haptic("medium", true);
    else if (kind === "fail") haptic("error", true);
  } catch (x) {}
  if (!G.sfxOn) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
  } catch (e) {
    return;
  }
  if (kind === "base") {
    tone(988, 0, 0.07);
    tone(1319, 0.07, 0.12);
  } else if (kind === "clear") {
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone(f, i * 0.09, 0.14);
    });
  } else if (kind === "gold") {
    [784, 988, 1175, 1568, 2093].forEach(function (f, i) {
      tone(f, i * 0.08, 0.16, "triangle", 0.08);
    });
  } else if (kind === "fail") {
    tone(110, 0, 0.35, "sawtooth", 0.07);
    tone(82, 0.18, 0.35, "sawtooth", 0.07);
  } else if (kind === "chime") {
    [1047, 1319, 1568, 2093].forEach(function (f, i) {
      tone(f, i * 0.11, 0.22, "triangle", 0.09);
    });
  } else if (kind === "stop") {
    [1568, 1175, 784, 523].forEach(function (f, i) {
      tone(f, i * 0.13, 0.26, "square", 0.07);
    });
    tone(392, 0.55, 0.4, "square", 0.06);
  } else if (kind === "squish") {
    /* Tomato squish (pomodoro start and finish), the in-app twin of native pc_squish.wav: noise through a resonant
       bandpass sweeping 1600 → 220 Hz with a gain wobble (the wet body), a sub thump and a few bubble glugs. */
    squish();
  } else if (kind === "level") {
    [392, 523, 659, 784, 659, 1047].forEach(function (f, i) {
      tone(f, i * 0.1, 0.18, "triangle", 0.09);
    });
  }
}
export function tapSound(k) {
  var t = TAPS[k];
  if (!t || !G.sfxOn || (S.cfg && S.cfg.tapSound === false)) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    tone(t[0], 0, t[1], "square", t[2]);
  } catch (x) {}
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  AC = null;
  G.sfxOn = uiGet("sfx", true) !== false;
  /* Tap sounds: a short 8-bit click that goes with every haptic tap. Off with Settings › Tap sounds, or with Sound off. */
  TAPS = { light: [1568, 0.03, 0.025], medium: [1175, 0.05, 0.035], heavy: [784, 0.07, 0.045] };
}
