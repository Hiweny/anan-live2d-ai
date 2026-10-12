/* ═══════════════════════════════════════════════════════════
   motion.js — 动作引擎
   驱动模型 30+ 个参数：待机呼吸感、情绪气息、一次性手势、
   口型同步。全部以「叠加(delta)」方式作用于框架已计算的
   呼吸/视线之上，不会打架。
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
    browLF: "ParamBrowLForm", browRF: "ParamBrowRForm"
  };

  /* 余弦缓动采样：keys = [[t0..1, v], ...] */
  function sample(keys, x) {
    if (x <= keys[0][0]) return keys[0][1];
    const n = keys.length;
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
    for (let i = 0; i < n - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (x >= a[0] && x <= b[0]) {
        const span = b[0] - a[0] || 1e-6;
        let u = (x - a[0]) / span;
        u = u * u * (3 - 2 * u); // smoothstep
        return a[1] + (b[1] - a[1]) * u;
      }
    }
    return keys[n - 1][1];
  }

  /* 手势库：每项 = {dur, loop?, tracks:[{id, mode:'add'|'set', keys}]}
     mode 省略即 add。所有数值基于 Live2D 标准参数范围。 */
  const GESTURES = {
    idle: { dur: 0.4, tracks: [] },

    nod: { dur: 1.0, tracks: [
      { id: P.angleY, keys: [[0,0],[0.22,-15],[0.42,2],[0.62,-10],[0.82,1],[1,0]] }
    ]},
    shake: { dur: 1.1, tracks: [
      { id: P.angleX, keys: [[0,0],[0.18,14],[0.4,-14],[0.6,11],[0.8,-11],[1,0]] },
      { id: P.angleZ, keys: [[0,0],[0.3,3],[0.6,-3],[1,0]] }
    ]},
    tilt: { dur: 1.0, tracks: [
      { id: P.angleZ, keys: [[0,0],[0.35,18],[0.72,13],[1,0]] },
      { id: P.angleX, keys: [[0,0],[0.4,4],[1,0]] }
    ]},
    look_away: { dur: 1.8, tracks: [
      { id: P.angleX, keys: [[0,0],[0.22,17],[0.72,17],[1,0]] },
      { id: P.angleZ, keys: [[0,0],[0.26,9],[0.72,9],[1,0]] },
      { id: P.eyeBx, keys: [[0,0],[0.22,-0.7],[0.72,-0.7],[1,0]] }
    ]},
    bounce: { dur: 1.0, tracks: [
      { id: P.angleY, keys: [[0,0],[0.25,-9],[0.5,3],[0.75,-6],[1,0]] },
      { id: P.bodyX, keys: [[0,0],[0.25,3],[0.5,-2],[0.75,2],[1,0]] },
      { id: P.bodyY, keys: [[0,0],[0.25,-2],[0.5,1],[1,0]] }
    ]},
    sway: { dur: 3.2, loop: true, tracks: [
      { id: P.bodyX, keys: [[0,0],[0.25,5],[0.5,0],[0.75,-5],[1,0]] },
      { id: P.angleZ, keys: [[0,0],[0.25,4],[0.5,0],[0.75,-4],[1,0]] },
      { id: P.angleX, keys: [[0,0],[0.25,3],[0.5,0],[0.75,-3],[1,0]] }
    ]},
    surprise: { dur: 1.0, tracks: [
      { id: P.angleY, keys: [[0,0],[0.12,-16],[0.42,-6],[1,0]] },
      { id: P.browLY, keys: [[0,0],[0.12,0.9],[0.5,0.6],[1,0]] },
      { id: P.browRY, keys: [[0,0],[0.12,0.9],[0.5,0.6],[1,0]] },
      { id: P.mouthY, mode: "set", keys: [[0,0],[0.15,0.7],[0.5,0.35],[1,0]] }
    ]},
    shy: { dur: 2.0, tracks: [
      { id: P.cheek, keys: [[0,0],[0.3,0.95],[0.75,0.7],[1,0]] },
      { id: P.angleY, keys: [[0,0],[0.3,11],[0.75,7],[1,0]] },
      { id: P.angleZ, keys: [[0,0],[0.4,14],[0.75,10],[1,0]] },
      { id: P.eyeBy, keys: [[0,0],[0.3,-0.6],[0.75,-0.4],[1,0]] },
      { id: P.mouthF, keys: [[0,0],[0.35,0.35],[0.75,0.25],[1,0]] }
    ]},
    think: { dur: 2.4, tracks: [
      { id: P.eyeBx, keys: [[0,0],[0.3,0.7],[0.8,0.55],[1,0]] },
      { id: P.eyeBy, keys: [[0,0],[0.3,0.5],[0.8,0.4],[1,0]] },
      { id: P.angleZ, keys: [[0,0],[0.4,11],[0.8,8],[1,0]] },
      { id: P.angleX, keys: [[0,0],[0.4,-6],[0.8,-4],[1,0]] }
    ]},
    pout: { dur: 1.5, tracks: [
      { id: P.mouthF, mode: "set", keys: [[0,0],[0.25,-0.65],[0.75,-0.5],[1,0]] },
      { id: P.angleZ, keys: [[0,0],[0.4,6],[1,0]] }
    ]},
    smile: { dur: 1.8, tracks: [
      { id: P.eyeLs, mode: "set", keys: [[0,0],[0.28,1],[0.72,1],[1,0]] },
      { id: P.eyeRs, mode: "set", keys: [[0,0],[0.28,1],[0.72,1],[1,0]] },
      { id: P.mouthF, mode: "set", keys: [[0,0],[0.28,0.6],[0.72,0.5],[1,0]] },
      { id: P.angleZ, keys: [[0,0],[0.3,4],[0.7,3],[1,0]] }
    ]},
    laugh: { dur: 1.6, tracks: [
      { id: P.eyeLs, mode: "set", keys: [[0,0],[0.2,1],[0.85,1],[1,0]] },
      { id: P.eyeRs, mode: "set", keys: [[0,0],[0.2,1],[0.85,1],[1,0]] },
      { id: P.mouthY, mode: "set", keys: [[0,0],[0.2,0.5],[0.3,0.85],[0.45,0.4],[0.6,0.8],[0.75,0.35],[1,0]] },
      { id: P.angleY, keys: [[0,0],[0.25,-7],[0.5,2],[0.75,-5],[1,0]] },
      { id: P.bodyX, keys: [[0,0],[0.3,3],[0.6,-3],[1,0]] }
    ]},
    sad: { dur: 2.2, tracks: [
      { id: P.mouthF, mode: "set", keys: [[0,0],[0.3,-0.55],[0.8,-0.45],[1,0]] },
      { id: P.angleY, keys: [[0,0],[0.3,10],[0.8,7],[1,0]] },
      { id: P.browLA, keys: [[0,0],[0.3,-0.8],[0.8,-0.6],[1,0]] },
      { id: P.browRA, keys: [[0,0],[0.3,-0.8],[0.8,-0.6],[1,0]] },
      { id: P.eyeBy, keys: [[0,0],[0.3,-0.35],[0.8,-0.25],[1,0]] }
    ]},
    angry: { dur: 1.5, tracks: [
      { id: P.mouthF, mode: "set", keys: [[0,0],[0.2,-0.6],[0.75,-0.5],[1,0]] },
      { id: P.browLA, keys: [[0,0],[0.2,0.9],[0.75,0.7],[1,0]] },
      { id: P.browRA, keys: [[0,0],[0.2,0.9],[0.75,0.7],[1,0]] },
      { id: P.angleX, keys: [[0,0],[0.15,6],[0.35,-6],[0.55,4],[1,0]] }
    ]},
    stretch: { dur: 1.7, tracks: [
      { id: P.angleY, keys: [[0,0],[0.3,-18],[0.75,-15],[1,0]] },
      { id: P.bodyX, keys: [[0,0],[0.3,4],[0.6,-4],[1,0]] },
      { id: P.mouthY, mode: "set", keys: [[0,0],[0.3,0.75],[0.7,0.45],[1,0]] }
    ]}
  };

  function MotionEngine(host) {
    this.host = host;            // { applyAdd(id,d), applySet(id,v,weight), hasParam(id), range(id) }
    this.t = 0;
    this._last = null;
    this._events = [];           // 播放中的一次性手势 {g, name, t, dur}
    this._moodGesture = null;    // 循环的待机/情绪手势
    this._moodGestureT = 0;
    this._ambient = { add: {}, set: {} };
    this._speaking = false;
    this._mouthLevel = 0;
    this._mouthTarget = 0;
    this._mouthSimT = 0;
    this._glance = null;
    this._nextGlance = 2 + Math.random() * 3;
    this.enabledIdle = true;
    this.mouthScale = 1;
    this.enabled = true;
  }

  MotionEngine.GESTURES = GESTURES;
  MotionEngine.P = P;

  MotionEngine.prototype.setIdle = function (on) { this.enabledIdle = !!on; };
  MotionEngine.prototype.setMouthScale = function (s) { this.mouthScale = s || 1; };

  /* 情绪 / 氛围（常驻叠加，直到改变） */
  MotionEngine.prototype.setMood = function (mood) {
    const map = AnAn.EMOTION_MAP[mood] || AnAn.EMOTION_MAP.neutral;
    this._ambient = { add: {}, set: {} };
    if (map.cheek) this._ambient.add[P.cheek] = map.cheek;
    if (map.mouth > 0) this._ambient.set[P.mouthF] = map.mouth;
    else if (map.mouth < 0) this._ambient.set[P.mouthF] = map.mouth;
    if (map.brow) {
      this._ambient.add[P.browLY] = map.brow;
      this._ambient.add[P.browRY] = map.brow;
    }
    if (map.gesture && map.gesture !== "idle") {
      this.playGesture(map.gesture, { ambient: true });
    } else {
      this._moodGesture = null;
    }
  };

  MotionEngine.prototype.clearAmbient = function () {
    this._ambient = { add: {}, set: {} };
    this._moodGesture = null;
  };

  /* 触发一次性手势；ambient=true 则作为循环氛围手势 */
  MotionEngine.prototype.playGesture = function (name, opts) {
    const g = GESTURES[name];
    if (!g) return false;
    opts = opts || {};
    if (opts.ambient && g.loop) {
      this._moodGesture = g; this._moodGestureT = 0; return true;
    }
    // 插入队列末尾（同名去重）
    for (let i = 0; i < this._events.length; i++) if (this._events[i].name === name) return true;
    this._events.push({ g: g, name: name, t: 0, dur: g.dur });
    return true;
  };

  MotionEngine.prototype.stopAll = function () {
    this._events.length = 0;
    this._moodGesture = null;
    this._ambient = { add: {}, set: {} };
  };

  /* ── 口型 ── */
  MotionEngine.prototype.setSpeaking = function (on) {
    this._speaking = !!on;
    if (!on) this._mouthTarget = 0;
  };
  MotionEngine.prototype.setMouthLevel = function (v) {
    this._mouthTarget = Math.max(0, Math.min(1.4, v));
  };
  MotionEngine.prototype._tickMouth = function (dt) {
    if (this._speaking) {
      // 无音频分析时用模拟包络
      this._mouthSimT += dt;
      const env = 0.28 + 0.62 * Math.abs(Math.sin(this._mouthSimT * 9.1)) * (0.6 + 0.4 * Math.random());
      if (this._audioDriven !== true) this._mouthTarget = Math.min(1, env);
    } else {
      this._mouthTarget = 0;
    }
    // 平滑逼近，形成自然的口型起伏
    this._mouthLevel += (this._mouthTarget - this._mouthLevel) * Math.min(1, dt * 18);
  };
  MotionEngine.prototype.setAudioDriven = function (b) { this._audioDriven = !!b; };

  /* ── 每帧：由 live2d 在 beforeModelUpdate 调用 ── */
  MotionEngine.prototype.apply = function (now) {
    const host = this.host;
    if (!this.enabled || !host) return;
    if (this._last == null) this._last = now;
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (!(dt > 0) || dt > 0.5) dt = 1 / 60;
    this.t += dt;

    this._tickMouth(dt);

    const adds = {};   // id -> delta   (此帧从零累加)
    const sets = {};   // id -> [value, weight]

    const add = (id, d) => { if (d) adds[id] = (adds[id] || 0) + d; };
    const set = (id, v, w) => { sets[id] = [v, w == null ? 1 : w]; };

    /* 1) 情绪常驻层 */
    for (const k in this._ambient.add) add(k, this._ambient.add[k]);
    for (const k in this._ambient.set) set(k, this._ambient.set[k]);

    /* 2) 待机微小动作 */
    if (this.enabledIdle) {
      const t = this.t;
      add(P.angleZ, Math.sin(t * 0.37) * 2.0);
      add(P.angleX, Math.sin(t * 0.26 + 1.1) * 1.6);
      add(P.bodyZ, Math.sin(t * 0.21 + 0.5) * 1.4);
      // 偶尔的“东张西望”
      this._nextGlance -= dt;
      if (!this._glance && this._nextGlance <= 0) {
        this._glance = {
          t: 0, dur: 1.4 + Math.random() * 1.2,
          ax: (Math.random() * 2 - 1) * 11,
          ay: (Math.random() * 2 - 1) * 6,
          bx: (Math.random() * 2 - 1) * 0.7,
          by: (Math.random() * 2 - 1) * 0.45
        };
        this._nextGlance = 4 + Math.random() * 6;
      }
      if (this._glance) {
        const g = this._glance; g.t += dt;
        let x = g.t / g.dur; if (x > 1) x = 1;
        // 先看看，再回来
        const ease = x < 0.5 ? (x / 0.5) : (1 - (x - 0.5) / 0.5);
        add(P.angleX, g.ax * ease);
        add(P.angleY, g.ay * ease);
        add(P.eyeBx, g.bx * ease);
        add(P.eyeBy, g.by * ease);
        if (x >= 1) this._glance = null;
      }
    }

    /* 3) 常驻循环手势（sway 等） */
    if (this._moodGesture) {
      const g = this._moodGesture;
      this._moodGestureT += dt;
      const lt = this._moodGestureT % g.dur;
      for (const tr of g.tracks) add(tr.id, sample(tr.keys, lt / g.dur));
    }

    /* 4) 一次性手势队列 */
    if (this._events.length) {
      const e = this._events[0];
      e.t += dt;
      const x = e.dur ? e.t / e.dur : 1;
      for (const tr of e.g.tracks) {
        const v = sample(tr.keys, Math.min(1, x));
        if (tr.mode === "set") set(tr.id, v);
        else add(tr.id, v);
      }
      if (e.t >= e.dur) this._events.shift();
    }

    /* 5) 口型 */
    const mouthVal = this._mouthLevel * 1.15 * this.mouthScale;
    if (mouthVal > 0.001) add(P.mouthY, mouthVal);

    /* 应用 */
    this.lastAdds = adds; this.lastSets = sets;
    for (const id in adds) if (host.hasParam(id)) host.applyAdd(id, adds[id]);
    for (const id in sets) if (host.hasParam(id)) host.applySet(id, sets[id][0], sets[id][1]);
  };

  AnAn.MotionEngine = MotionEngine;
})(window);
