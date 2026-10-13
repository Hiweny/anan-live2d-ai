/* ═══════════════════════════════════════════════════════════
   motion.js — 动作引擎 v2
   程序化驱动模型参数：待机微动作 + 情绪气息 + 一次性手势 + 口型。
   全部以「叠加」方式作用于框架已算好的呼吸/视线之上。
   手势追求自然、克制、有停顿。
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  const P = {
    angleX: "ParamAngleX", angleY: "ParamAngleY", angleZ: "ParamAngleZ",
    bodyX: "ParamBodyAngleX", bodyY: "ParamBodyAngleY", bodyZ: "ParamBodyAngleZ",
    eyeL: "ParamEyeLOpen", eyeR: "ParamEyeROpen",
    eyeLs: "ParamEyeLSmile", eyeRs: "ParamEyeRSmile",
    eyeBx: "ParamEyeBallX", eyeBy: "ParamEyeBallY",
    mouthY: "ParamMouthOpenY", mouthF: "ParamMouthForm",
    cheek: "ParamCheek",
    browLY: "ParamBrowLY", browRY: "ParamBrowRY",
    browLA: "ParamBrowLAngle", browRA: "ParamBrowRAngle",
    browLX: "ParamBrowLX", browRX: "ParamBrowRX",
    armL: "ParamArmL", armR: "ParamArmR"
  };

  function smoother(u) { return u * u * u * (u * (u * 6 - 15) + 10); }
  function sample(keys, x) {
    const n = keys.length;
    if (x <= keys[0][0]) return keys[0][1];
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
    for (let i = 0; i < n - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (x >= a[0] && x <= b[0]) {
        const span = b[0] - a[0] || 1e-6;
        return a[1] + (b[1] - a[1]) * smoother((x - a[0]) / span);
      }
    }
    return keys[n - 1][1];
  }

  /* 手势库（rangeRel: 数值为参数范围的占比，用于手臂等未知范围的参数） */
  const G = {
    idle: { dur: 0.4, tracks: [] },

    nod: { dur: 1.0, tracks: [{ id: P.angleY, keys: [[0, 0], [0.22, -11], [0.45, 1], [0.68, -7], [0.88, 0], [1, 0]] }] },
    shake: { dur: 1.1, tracks: [
      { id: P.angleX, keys: [[0, 0], [0.2, 11], [0.42, -11], [0.64, 8], [0.84, -8], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.32, 2.5], [0.64, -2.5], [1, 0]] }
    ] },
    tilt: { dur: 1.1, tracks: [
      { id: P.angleZ, keys: [[0, 0], [0.35, 15], [0.78, 11], [1, 0]] },
      { id: P.angleX, keys: [[0, 0], [0.4, 3], [1, 0]] }
    ] },
    look_away: { dur: 1.9, tracks: [
      { id: P.angleX, keys: [[0, 0], [0.22, 14], [0.74, 14], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.26, 7], [0.74, 7], [1, 0]] },
      { id: P.eyeBx, keys: [[0, 0], [0.22, -0.65], [0.74, -0.65], [1, 0]] }
    ] },
    look_up: { dur: 1.8, tracks: [
      { id: P.angleY, keys: [[0, 0], [0.25, -13], [0.72, -11], [1, 0]] },
      { id: P.eyeBy, keys: [[0, 0], [0.25, 0.6], [0.72, 0.5], [1, 0]] }
    ] },
    bounceSoft: { dur: 1.0, tracks: [
      { id: P.angleY, keys: [[0, 0], [0.28, -6], [0.55, 2], [0.8, -3], [1, 0]] },
      { id: P.bodyY, keys: [[0, 0], [0.28, -2], [1, 0]] }
    ] },
    bounce: { dur: 0.95, tracks: [
      { id: P.angleY, keys: [[0, 0], [0.24, -9], [0.5, 3], [0.76, -5], [1, 0]] },
      { id: P.bodyY, keys: [[0, 0], [0.24, -3], [0.5, 1], [1, 0]] },
      { id: P.bodyX, keys: [[0, 0], [0.3, 3], [0.6, -3], [1, 0]] }
    ] },
    sway: { dur: 4.0, loop: true, tracks: [
      { id: P.bodyX, keys: [[0, 0], [0.25, 4], [0.5, 0], [0.75, -4], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.25, 3], [0.5, 0], [0.75, -3], [1, 0]] },
      { id: P.angleX, keys: [[0, 0], [0.25, 2.5], [0.5, 0], [0.75, -2.5], [1, 0]] }
    ] },
    surprise: { dur: 1.0, tracks: [
      { id: P.angleY, keys: [[0, 0], [0.12, -13], [0.45, -5], [1, 0]] },
      { id: P.browLY, keys: [[0, 0], [0.12, 0.9], [0.5, 0.5], [1, 0]] },
      { id: P.browRY, keys: [[0, 0], [0.12, 0.9], [0.5, 0.5], [1, 0]] },
      { id: P.mouthY, mode: "set", keys: [[0, 0], [0.15, 0.6], [0.5, 0.25], [1, 0]] }
    ] },
    shy: { dur: 2.2, tracks: [
      { id: P.cheek, keys: [[0, 0], [0.3, 0.95], [0.8, 0.75], [1, 0]] },
      { id: P.angleY, keys: [[0, 0], [0.3, 10], [0.8, 7], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.4, 12], [0.8, 9], [1, 0]] },
      { id: P.eyeBy, keys: [[0, 0], [0.3, -0.5], [0.8, -0.35], [1, 0]] },
      { id: P.mouthF, mode: "set", keys: [[0, 0], [0.35, 0.32], [0.8, 0.24], [1, 0]] }
    ] },
    think: { dur: 2.6, tracks: [
      { id: P.eyeBx, keys: [[0, 0], [0.3, 0.6], [0.82, 0.5], [1, 0]] },
      { id: P.eyeBy, keys: [[0, 0], [0.3, 0.42], [0.82, 0.35], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.4, 9], [0.82, 7], [1, 0]] },
      { id: P.angleX, keys: [[0, 0], [0.4, -5], [0.82, -3.5], [1, 0]] }
    ] },
    pout: { dur: 1.6, tracks: [
      { id: P.mouthF, mode: "set", keys: [[0, 0], [0.25, -0.6], [0.78, -0.45], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.4, 5], [1, 0]] }
    ] },
    smile: { dur: 1.8, tracks: [
      { id: P.eyeLs, mode: "set", keys: [[0, 0], [0.3, 1], [0.74, 1], [1, 0]] },
      { id: P.eyeRs, mode: "set", keys: [[0, 0], [0.3, 1], [0.74, 1], [1, 0]] },
      { id: P.mouthF, mode: "set", keys: [[0, 0], [0.3, 0.55], [0.74, 0.45], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.3, 3.5], [0.74, 2.5], [1, 0]] }
    ] },
    laugh: { dur: 1.7, tracks: [
      { id: P.eyeLs, mode: "set", keys: [[0, 0], [0.2, 1], [0.85, 1], [1, 0]] },
      { id: P.eyeRs, mode: "set", keys: [[0, 0], [0.2, 1], [0.85, 1], [1, 0]] },
      { id: P.mouthY, mode: "set", keys: [[0, 0], [0.2, 0.45], [0.32, 0.8], [0.46, 0.35], [0.6, 0.75], [0.76, 0.3], [1, 0]] },
      { id: P.angleY, keys: [[0, 0], [0.25, -6], [0.5, 2], [0.75, -4], [1, 0]] },
      { id: P.bodyX, keys: [[0, 0], [0.3, 3], [0.6, -3], [1, 0]] }
    ] },
    sad: { dur: 2.4, tracks: [
      { id: P.mouthF, mode: "set", keys: [[0, 0], [0.3, -0.5], [0.82, -0.4], [1, 0]] },
      { id: P.angleY, keys: [[0, 0], [0.3, 9], [0.82, 6], [1, 0]] },
      { id: P.browLY, keys: [[0, 0], [0.3, -0.5], [0.82, -0.4], [1, 0]] },
      { id: P.browRY, keys: [[0, 0], [0.3, -0.5], [0.82, -0.4], [1, 0]] },
      { id: P.eyeBy, keys: [[0, 0], [0.3, -0.3], [0.82, -0.22], [1, 0]] }
    ] },
    angry: { dur: 1.6, tracks: [
      { id: P.mouthF, mode: "set", keys: [[0, 0], [0.2, -0.55], [0.78, -0.45], [1, 0]] },
      { id: P.browLA, keys: [[0, 0], [0.2, 0.85], [0.78, 0.65], [1, 0]] },
      { id: P.browRA, keys: [[0, 0], [0.2, 0.85], [0.78, 0.65], [1, 0]] },
      { id: P.angleX, keys: [[0, 0], [0.15, 5], [0.35, -5], [0.55, 3], [1, 0]] }
    ] },
    stretch: { dur: 1.9, tracks: [
      { id: P.angleY, keys: [[0, 0], [0.3, -15], [0.78, -12], [1, 0]] },
      { id: P.bodyX, keys: [[0, 0], [0.3, 3.5], [0.6, -3.5], [1, 0]] },
      { id: P.armL, rangeRel: true, keys: [[0, 0], [0.3, 0.35], [0.8, 0.3], [1, 0]] },
      { id: P.armR, rangeRel: true, keys: [[0, 0], [0.3, 0.35], [0.8, 0.3], [1, 0]] },
      { id: P.mouthY, mode: "set", keys: [[0, 0], [0.3, 0.6], [0.72, 0.35], [1, 0]] }
    ] },
    arm_wave: { dur: 1.8, tracks: [
      { id: P.armR, rangeRel: true, keys: [[0, 0], [0.18, 0.75], [0.38, 0.45], [0.58, 0.75], [0.78, 0.45], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.25, -4], [0.7, -3], [1, 0]] },
      { id: P.mouthF, mode: "set", keys: [[0, 0], [0.25, 0.4], [0.7, 0.3], [1, 0]] }
    ] },
    arm_up: { dur: 1.6, tracks: [
      { id: P.armR, rangeRel: true, keys: [[0, 0], [0.3, 0.85], [0.78, 0.8], [1, 0]] },
      { id: P.angleY, keys: [[0, 0], [0.3, -4], [1, 0]] }
    ] },
    shrug: { dur: 1.6, tracks: [
      { id: P.armL, rangeRel: true, keys: [[0, 0], [0.3, 0.4], [0.78, 0.35], [1, 0]] },
      { id: P.armR, rangeRel: true, keys: [[0, 0], [0.3, 0.4], [0.78, 0.35], [1, 0]] },
      { id: P.angleZ, keys: [[0, 0], [0.3, 5], [0.78, 3], [1, 0]] },
      { id: P.browLY, keys: [[0, 0], [0.3, 0.35], [0.78, 0.25], [1, 0]] },
      { id: P.browRY, keys: [[0, 0], [0.3, 0.35], [0.78, 0.25], [1, 0]] }
    ] },
    clap: { dur: 1.5, tracks: [
      { id: P.armL, rangeRel: true, keys: [[0, 0], [0.2, 0.5], [0.4, 0.25], [0.6, 0.5], [0.8, 0.25], [1, 0]] },
      { id: P.armR, rangeRel: true, keys: [[0, 0], [0.2, 0.5], [0.4, 0.25], [0.6, 0.5], [0.8, 0.25], [1, 0]] },
      { id: P.angleY, keys: [[0, 0], [0.3, -3], [1, 0]] }
    ] }
  };

  function MotionEngine(host) {
    this.host = host;
    this.t = 0; this._last = null;
    this._events = [];
    this._moodGesture = null; this._moodT = 0;
    this._ambientAdd = {}; this._ambientSet = {};
    this._speaking = false; this._mouthLevel = 0; this._mouthTarget = 0; this._mouthSimT = 0;
    this._glance = null; this._nextGlance = 3 + Math.random() * 4;
    this.enabled = true; this.enabledIdle = true; this.mouthScale = 1;
    this.lastAdds = {}; this.lastSets = {};
  }
  MotionEngine.GESTURES = G;
  MotionEngine.P = P;

  MotionEngine.prototype.setIdle = function (on) { this.enabledIdle = !!on; };
  MotionEngine.prototype.setMouthScale = function (s) { this.mouthScale = s || 1; };

  MotionEngine.prototype.setMood = function (mood) {
    const map = AnAn.EMOTION_MAP[mood] || AnAn.EMOTION_MAP.neutral;
    this._ambientAdd = Object.assign({}, map.add || {});
    this._ambientSet = Object.assign({}, map.set || {});
    if (map.gesture && G[map.gesture]) {
      if (G[map.gesture].loop) { this._moodGesture = G[map.gesture]; this._moodT = 0; }
      else { this._moodGesture = null; this.playGesture(map.gesture); }
    } else { this._moodGesture = null; }
  };
  MotionEngine.prototype.clearMood = function () {
    this._ambientAdd = {}; this._ambientSet = {}; this._moodGesture = null;
  };

  MotionEngine.prototype.playGesture = function (name) {
    const g = G[name];
    if (!g) return false;
    for (let i = 0; i < this._events.length; i++) if (this._events[i].name === name) return true;
    if (this._events.length >= 2) return true;              // 队列最多 2 个，避免堆砌
    this._events.push({ g: g, name: name, t: 0, dur: g.dur });
    return true;
  };
  MotionEngine.prototype.stopAll = function () { this._events.length = 0; this._moodGesture = null; this.clearMood(); };

  MotionEngine.prototype.setSpeaking = function (on) { this._speaking = !!on; if (!on) this._mouthTarget = 0; };
  MotionEngine.prototype.setMouthLevel = function (v) { this._mouthTarget = Math.max(0, Math.min(1.4, v)); };
  MotionEngine.prototype.setAudioDriven = function (b) { this._audioDriven = !!b; };
  MotionEngine.prototype._tickMouth = function (dt) {
    if (this._speaking) {
      this._mouthSimT += dt;
      if (this._audioDriven !== true) {
        this._mouthTarget = Math.min(1, 0.26 + 0.6 * Math.abs(Math.sin(this._mouthSimT * 9.1)) * (0.6 + 0.4 * Math.random()));
      }
    } else this._mouthTarget = 0;
    this._mouthLevel += (this._mouthTarget - this._mouthLevel) * Math.min(1, dt * 18);
  };

  MotionEngine.prototype.apply = function (now) {
    const host = this.host;
    if (!this.enabled || !host) return;
    if (this._last == null) this._last = now;
    let dt = (now - this._last) / 1000; this._last = now;
    if (!(dt > 0) || dt > 0.5) dt = 1 / 60;
    this.t += dt;
    this._tickMouth(dt);

    const adds = {}, sets = {};
    const add = (id, d) => { if (d) adds[id] = (adds[id] || 0) + d; };
    const set = (id, v) => { sets[id] = v; };

    for (const k in this._ambientAdd) add(k, this._ambientAdd[k]);
    for (const k in this._ambientSet) set(k, this._ambientSet[k]);

    if (this.enabledIdle) {
      const t = this.t;
      add(P.angleZ, Math.sin(t * 0.35) * 1.6);
      add(P.angleX, Math.sin(t * 0.24 + 1.1) * 1.3);
      add(P.bodyZ, Math.sin(t * 0.19 + 0.5) * 1.1);
      this._nextGlance -= dt;
      if (!this._glance && this._nextGlance <= 0) {
        this._glance = { t: 0, dur: 1.5 + Math.random() * 1.3, ax: (Math.random() * 2 - 1) * 9, ay: (Math.random() * 2 - 1) * 5, bx: (Math.random() * 2 - 1) * 0.6, by: (Math.random() * 2 - 1) * 0.4 };
        this._nextGlance = 5 + Math.random() * 7;
      }
      if (this._glance) {
        const g = this._glance; g.t += dt;
        let x = Math.min(1, g.t / g.dur);
        const e = x < 0.5 ? (x / 0.5) : (1 - (x - 0.5) / 0.5);
        add(P.angleX, g.ax * e); add(P.angleY, g.ay * e); add(P.eyeBx, g.bx * e); add(P.eyeBy, g.by * e);
        if (x >= 1) this._glance = null;
      }
    }

    if (this._moodGesture) {
      const g = this._moodGesture; this._moodT += dt;
      const lt = this._moodT % g.dur;
      for (const tr of g.tracks) add(tr.id, sample(tr.keys, lt / g.dur));
    }

    if (this._events.length) {
      const e = this._events[0]; e.t += dt;
      const x = e.dur ? e.t / e.dur : 1;
      for (const tr of e.g.tracks) {
        const v = sample(tr.keys, Math.min(1, x));
        if (tr.rangeRel) {
          const r = host.range(tr.id); const span = (r[1] - r[0]) || 1;
          if (tr.mode === "set") set(tr.id, r[0] + v * span); else add(tr.id, v * span);
        } else if (tr.mode === "set") set(tr.id, v);
        else add(tr.id, v);
      }
      if (e.t >= e.dur) this._events.shift();
    }

    const mouthVal = this._mouthLevel * 1.15 * this.mouthScale;
    if (mouthVal > 0.001) add(P.mouthY, mouthVal);

    this.lastAdds = adds; this.lastSets = sets;
    for (const id in adds) if (host.hasParam(id)) host.applyAdd(id, adds[id]);
    for (const id in sets) if (host.hasParam(id)) host.applySet(id, sets[id], 1);
  };

  AnAn.MotionEngine = MotionEngine;
})(window);
