/* ---- 8-bit sound ---- */
import { G } from "../core/g.js";
import { S } from "../core/00-state.js";
import { uiGet } from "../core/config.js";
import { haptic } from "./45-gestures.js";

export var AC, TAPS, sampleBuf;

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
/* Recorded samples (public/sounds/<name>.wav, the same files the native channels play): the tomato squish (a new
     pomodoro set starting). Each is fetched and decoded once into sampleBuf[name]; nothing plays
     until it has loaded, and a failed load stays silent. */
export function sample(name) {
  var b = sampleBuf[name];
  if (b === null) return;
  if (b) {
    var src = AC.createBufferSource(),
      g = AC.createGain();
    g.gain.value = 0.9;
    src.buffer = b;
    src.connect(g);
    g.connect(AC.destination);
    src.start();
    return;
  }
  sampleBuf[name] = null;
  fetch("sounds/" + name + ".wav")
    .then(function (r) {
      return r.arrayBuffer();
    })
    .then(function (ab) {
      return AC.decodeAudioData(ab);
    })
    .then(function (buf) {
      sampleBuf[name] = buf;
      sample(name);
    })
    .catch(function () {
      sampleBuf[name] = undefined;
    });
}
export function sfx(kind) {
  try {
    if (kind === "base") haptic("medium", true);
    else if (kind === "clear" || kind === "level" || kind === "chime") haptic("success", true);
    else if (kind === "stop") haptic("heavy", true);
    else if (kind === "squish") haptic("medium", true);
    else if (kind === "beep1" || kind === "beep2" || kind === "beep3") haptic("success", true);
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
    sample("squish");
  } else if (kind === "beep1" || kind === "beep2" || kind === "beep3") {
    /* Pomodoro cues: one beep = back to work, two = short break, three = long break (the native pc_beepN.wav twins). */
    for (var bi = 0; bi < +kind.slice(4); bi++) tone(880, bi * 0.22, 0.12, "square", 0.07);
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
  sampleBuf = {};
  G.sfxOn = uiGet("sfx", true) !== false;
  /* Tap sounds: a short 8-bit click that goes with every haptic tap. Off with Settings › Tap sounds, or with Sound off. */
  TAPS = { light: [1568, 0.03, 0.025], medium: [1175, 0.05, 0.035], heavy: [784, 0.07, 0.045] };
}
