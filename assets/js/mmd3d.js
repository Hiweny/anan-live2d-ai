/* ═══════════════════════════════════════════════════════════
   mmd3d.js — 3D（MMD / PMX）控制器 v2
   Three.js + MMDLoader（无物理，纯程序化驱动）
   能力：拖动旋转 / 缩放 / 闲置慢转 / 自然站姿 /
        全身体动作（含 360° 转身）/ 姿态（抱臂・叉腰…）/ 表情 morph / 口型
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { MMDLoader } from "./lib/three/loaders/MMDLoader.js";

(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  function smooth(u) { return u * u * (3 - 2 * u); }
  function sample(keys, x) {
    const n = keys.length;
    if (x <= keys[0][0]) return keys[0][1];
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
    for (let i = 0; i < n - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (x >= a[0] && x <= b[0]) {
        const span = b[0] - a[0] || 1e-6;
        return a[1] + (b[1] - a[1]) * smooth((x - a[0]) / span);
      }
    }
    return keys[n - 1][1];
  }

  /* 手臂「下垂」基准（把 T-pose 放下来）：左腕 +z 抬起 / 右腕 -z 抬起 */
  const REST = { armL: { z: -1.12 }, armR: { z: 1.12 } };

  /* 姿态预设：手臂 z 抬/放、x 前后摆，肘部 z 弯曲（左右镜像） */
  const ARMS = {
    down:  { armL: { z: -1.12, x: 0.0 }, armR: { z: 1.12, x: 0.0 }, eL: 0, eR: 0 },
    open:  { armL: { z: -0.5, x: 0.0 }, armR: { z: 0.5, x: 0.0 }, eL: 0, eR: 0 },
    up:    { armL: { z: 1.25, x: 0.0 }, armR: { z: -1.25, x: 0.0 }, eL: 0, eR: 0 }
  };
  const FACING = { front: 0, left: Math.PI / 2, right: -Math.PI / 2, back: Math.PI };

  /* ── 动作库（tracks 用骨骼槽位 a:'x'/'y'/'z'；b:'__root' 表示整体）── */
  const GEST = {
    idle: { dur: 0.4, tracks: [] },
    nod: { dur: 1.0, tracks: [{ b: "head", a: "x", keys: [[0, 0], [0.22, 0.22], [0.46, 0.02], [0.72, 0.12], [1, 0]] }] },
    shake: { dur: 1.1, tracks: [
      { b: "head", a: "y", keys: [[0, 0], [0.2, 0.24], [0.42, -0.24], [0.64, 0.17], [0.84, -0.17], [1, 0]] }] },
    tilt: { dur: 1.1, tracks: [
      { b: "head", a: "z", keys: [[0, 0], [0.35, 0.34], [0.78, 0.26], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.4, -0.06], [1, 0]] }] },
    look_up: { dur: 1.8, tracks: [{ b: "head", a: "x", keys: [[0, 0], [0.25, -0.3], [0.72, -0.24], [1, 0]] }] },
    look_away: { dur: 1.9, tracks: [
      { b: "head", a: "y", keys: [[0, 0], [0.22, 0.5], [0.74, 0.5], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.26, 0.12], [0.74, 0.12], [1, 0]] }] },
    turn_left: { dur: 2.0, tracks: [{ b: "__root", a: "ry", keys: [[0, 0], [0.3, 1.35], [0.7, 1.35], [1, 0]] }] },
    turn_right: { dur: 2.0, tracks: [{ b: "__root", a: "ry", keys: [[0, 0], [0.3, -1.35], [0.7, -1.35], [1, 0]] }] },
    turn_around: { dur: 2.2, tracks: [{ b: "__root", a: "ry", keys: [[0, 0], [0.15, 0.2], [0.85, 6.48], [1, 6.48]] }] },
    bow: { dur: 2.2, tracks: [
      { b: "upper", a: "x", keys: [[0, 0], [0.3, 0.5], [0.65, 0.5], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, 0.22], [0.65, 0.2], [1, 0]] }] },
    bounce: { dur: 0.95, tracks: [
      { b: "__root", a: "y", keys: [[0, 0], [0.24, 1.1], [0.5, -0.2], [0.76, 0.5], [1, 0]] },
      { b: "lower", a: "x", keys: [[0, 0], [0.24, -0.08], [1, 0]] }] },
    jump: { dur: 1.3, tracks: [
      { b: "__root", a: "y", keys: [[0, 0], [0.15, -0.3], [0.45, 1.9], [0.72, -0.1], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, -0.1], [1, 0]] }] },
    sway: { dur: 4.0, loop: true, tracks: [
      { b: "__root", a: "rz", keys: [[0, 0], [0.25, 0.05], [0.5, 0], [0.75, -0.05], [1, 0]] },
      { b: "upper", a: "z", keys: [[0, 0], [0.25, 0.05], [0.5, 0], [0.75, -0.05], [1, 0]] }] },
    stretch: { dur: 2.0, tracks: [
      { b: "armL", a: "z", keys: [[0, 0], [0.3, 1.7], [0.8, 1.6], [1, 0]] },
      { b: "armR", a: "z", keys: [[0, 0], [0.3, -1.7], [0.8, -1.6], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, -0.18], [0.8, -0.12], [1, 0]] }] },
    arm_wave: { dur: 1.8, tracks: [
      { b: "armR", a: "z", keys: [[0, 0], [0.18, -1.35], [0.4, -1.05], [0.62, -1.35], [0.82, -1.05], [1, 0]] },
      { m: "smile", keys: [[0, 0], [0.25, 0.7], [0.75, 0.55], [1, 0]] }] },
    arm_up: { dur: 1.6, tracks: [{ b: "armR", a: "z", keys: [[0, 0], [0.3, -1.6], [0.78, -1.5], [1, 0]] }] },
    arms_cross: { dur: 2.2, tracks: [
      { b: "armL", a: "z", keys: [[0, 0], [0.35, -0.16], [1, 0]] },
      { b: "armR", a: "z", keys: [[0, 0], [0.35, 0.16], [1, 0]] },
      { b: "armL", a: "x", keys: [[0, 0], [0.35, 0.6], [1, 0]] },
      { b: "armR", a: "x", keys: [[0, 0], [0.35, -0.6], [1, 0]] }] },
    hands_on_hips: { dur: 2.2, tracks: [
      { b: "armL", a: "z", keys: [[0, 0], [0.35, -0.4], [1, 0]] },
      { b: "armR", a: "z", keys: [[0, 0], [0.35, 0.4], [1, 0]] },
      { b: "armL", a: "x", keys: [[0, 0], [0.35, 0.55], [1, 0]] },
      { b: "armR", a: "x", keys: [[0, 0], [0.35, -0.55], [1, 0]] }] },
    point: { dur: 1.8, tracks: [
      { b: "armR", a: "z", keys: [[0, 0], [0.3, -0.7], [0.78, -0.65], [1, 0]] },
      { b: "armR", a: "x", keys: [[0, 0], [0.3, -0.55], [0.78, -0.5], [1, 0]] },
      { b: "head", a: "y", keys: [[0, 0], [0.3, -0.12], [1, 0]] }] },
    peace: { dur: 1.8, tracks: [
      { b: "armR", a: "z", keys: [[0, 0], [0.3, -1.5], [0.78, -1.42], [1, 0]] },
      { m: "smile", keys: [[0, 0], [0.3, 0.8], [0.78, 0.7], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.3, -0.1], [1, 0]] }] },
    clap: { dur: 1.5, tracks: [
      { b: "armL", a: "x", keys: [[0, 0], [0.2, 0.85], [0.4, 0.4], [0.6, 0.85], [0.8, 0.4], [1, 0]] },
      { b: "armR", a: "x", keys: [[0, 0], [0.2, -0.85], [0.4, -0.4], [0.6, -0.85], [0.8, -0.4], [1, 0]] },
      { m: "smile", keys: [[0, 0], [0.3, 0.65], [0.8, 0.55], [1, 0]] }] },
    shrug: { dur: 1.6, tracks: [
      { b: "armL", a: "z", keys: [[0, 0], [0.3, -0.05], [0.78, -0.02], [1, 0]] },
      { b: "armR", a: "z", keys: [[0, 0], [0.3, 0.05], [0.78, 0.02], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.3, 0.1], [1, 0]] }] },
    shy: { dur: 2.2, tracks: [
      { m: "shy", keys: [[0, 0], [0.3, 0.9], [0.8, 0.75], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, 0.22], [0.8, 0.16], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.4, 0.22], [0.8, 0.16], [1, 0]] },
      { b: "armL", a: "x", keys: [[0, 0], [0.35, 0.5], [0.85, 0.4], [1, 0]] },
      { b: "armR", a: "x", keys: [[0, 0], [0.35, -0.5], [0.85, -0.4], [1, 0]] }] },
    think: { dur: 2.6, tracks: [
      { b: "head", a: "z", keys: [[0, 0], [0.4, 0.2], [0.82, 0.15], [1, 0]] },
      { b: "head", a: "y", keys: [[0, 0], [0.4, -0.15], [0.82, -0.1], [1, 0]] }] },
    pout: { dur: 1.6, tracks: [{ b: "head", a: "z", keys: [[0, 0], [0.4, -0.12], [1, 0]] }] },
    smile: { dur: 1.8, tracks: [{ m: "smile", keys: [[0, 0], [0.3, 0.9], [0.74, 0.75], [1, 0]] }] },
    laugh: { dur: 1.7, tracks: [
      { m: "smile", keys: [[0, 0], [0.2, 1], [0.85, 1], [1, 0]] },
      { b: "__root", a: "y", keys: [[0, 0], [0.25, 0.8], [0.5, -0.1], [0.75, 0.5], [1, 0]] }] },
    sad: { dur: 2.4, tracks: [
      { m: "sad", keys: [[0, 0], [0.3, 0.9], [0.82, 0.7], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, 0.2], [0.82, 0.14], [1, 0]] }] },
    angry: { dur: 1.6, tracks: [
      { m: "angry", keys: [[0, 0], [0.2, 0.95], [0.78, 0.7], [1, 0]] },
      { b: "head", a: "y", keys: [[0, 0], [0.15, 0.08], [0.35, -0.08], [0.55, 0.05], [1, 0]] }] },
    surprise: { dur: 1.0, tracks: [
      { b: "head", a: "x", keys: [[0, 0], [0.12, -0.26], [0.5, -0.1], [1, 0]] },
      { m: "surprised", keys: [[0, 0], [0.15, 0.9], [0.55, 0.5], [1, 0]] }] }
  };

  function MMD3D(opts) {
    this.canvas = opts.canvas;
    this.onProgress = opts.onProgress || function () {};
    this.onHit = opts.onHit || function () {};
    this.onAnchor = opts.onAnchor || function () {};
    this.def = null;
    this._ready = false;
    this._visible = false;
    this._yaw = 0; this._pitch = 0.06; this._dist = 40; this._baseDist = 40;
    this._target = new THREE.Vector3(0, 8, 0);
    this._idleT = 0; this._dragging = false;
    this._ptr = new Map(); this._pinch = 0;
    this._scale = 1; this._ux = 0; this._uy = 0; this._opacity = 1;
    this._insetTop = 0; this._insetBottom = 0;
    this._acts = []; this._mood = null; this._moodT = 0;
    this._bones = {}; this._morphs = {}; this._morphObjs = [];
    this._base = new Map();
    this._speaking = false; this._mouthLevel = 0; this._mouthTarget = 0; this._mouthSimT = 0; this._mouthScale = 1;
    this._posture = { arms: "down", facing: "front" };
    this._armsCur = { armL: { z: ARMS.down.armL.z, x: ARMS.down.armL.x }, armR: { z: ARMS.down.armR.z, x: ARMS.down.armR.x } };
    this._last = 0; this._raf = null;
    this.onProgress(0);
  }

  MMD3D.prototype._findBone = function (skeleton, keys) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      for (let j = 0; j < skeleton.bones.length; j++) if (skeleton.bones[j].name.indexOf(k) !== -1) return skeleton.bones[j];
    }
    return null;
  };

  MMD3D.prototype.load = async function (def) {
    const self = this;
    this.def = def;
    if (!this._renderer) this._initRenderer();
    const W = this.canvas.clientWidth || root.innerWidth;
    const H = this.canvas.clientHeight || root.innerHeight;
    this._renderer.setSize(W, H, false);

    if (this._model) { this.scene.remove(this._model); this._model = null; }

    const loader = new MMDLoader();
    const model = await new Promise(function (resolve, reject) {
      loader.load(def.model, resolve, function (xhr) { if (xhr && xhr.total) self.onProgress(0.1 + 0.8 * (xhr.loaded / xhr.total)); }, reject);
    });
    this.onProgress(0.95);
    this._model = model;
    this.scene.add(model);
    model.traverse(function (o) { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });

    let skinned = null;
    model.traverse(function (o) { if (!skinned && o.isSkinnedMesh) skinned = o; });
    this._skinned = skinned;
    this._bones = {}; this._base.clear();
    if (skinned) {
      const sk = skinned.skeleton;
      for (const slot in AnAn.MMD_BONES) this._bones[slot] = this._findBone(sk, AnAn.MMD_BONES[slot]);
      sk.bones.forEach(function (b) { self._base.set(b, { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z }); });
      // 把「自然站姿」并入基准，避免 T-pose
      for (const slot in REST) {
        const b = this._bones[slot], r = REST[slot];
        if (b && this._base.has(b)) { const base = this._base.get(b); base.z += (r.z || 0); base.x += (r.x || 0); base.y += (r.y || 0); }
      }
    }
    this._morphs = {}; this._morphObjs = [];
    model.traverse(function (o) {
      if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
        self._morphObjs.push(o);
        for (const slot in AnAn.MMD_MORPHS) {
          const keys = AnAn.MMD_MORPHS[slot];
          for (let i = 0; i < keys.length && self._morphs[slot] == null; i++) {
            const idx = o.morphTargetDictionary[keys[i]];
            if (idx != null) self._morphs[slot] = { mesh: o, idx: idx };
          }
        }
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    this._modelH = Math.max(1, box.max.y - box.min.y);
    this._computeFit();
    this._dist = this._baseDist;
    this._pitch = 0.08;
    this._yaw = 0;
    this._applyTransform();

    this._ready = true;
    this._visible = true;
    this._last = performance.now();
    this._idleT = 3;
    this._startLoop();
    this.onProgress(1);
    return this;
  };

  MMD3D.prototype._initRenderer = function () {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    this._renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const cam = new THREE.PerspectiveCamera(32, 1, 1, 4000);
    this.camera = cam;

    scene.add(new THREE.AmbientLight(0xffffff, 0.74));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.95); d1.position.set(3, 8, 6); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xbfd4ff, 0.42); d2.position.set(-5, 4, -4); scene.add(d2);

    this._bindInput();
  };

  MMD3D.prototype._computeFit = function () {
    const H = this._modelH || 20;
    const vh = this.canvas.clientHeight || root.innerHeight;
    const vw = this.canvas.clientWidth || root.innerWidth;
    const fov = this.camera.fov * Math.PI / 180;
    let dist = (H * 0.5) / Math.tan(fov * 0.5) / 0.64;
    const aspect = vw / Math.max(1, vh);
    if (aspect < 0.9) dist *= (0.9 / Math.max(0.5, aspect));
    this._baseDist = dist;
    this._target.set(0, H * 0.52, 0);
  };

  MMD3D.prototype._bindInput = function () {
    const self = this, cv = this.canvas;
    const P = function (e) { return { x: e.clientX, y: e.clientY }; };
    cv.addEventListener("pointerdown", function (e) {
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      self._ptr.set(e.pointerId, P(e));
      self._dragMoved = 0; self._idleT = 0;
      if (self._ptr.size === 2) self._pinch = self._pinchDist();
    });
    cv.addEventListener("pointermove", function (e) {
      if (!self._ptr.has(e.pointerId)) return;
      const prev = self._ptr.get(e.pointerId); const cur = P(e);
      self._ptr.set(e.pointerId, cur);
      self._idleT = 0;
      if (self._ptr.size >= 2) {
        const d = self._pinchDist();
        if (self._pinch > 0) { self._dist *= (self._pinch / Math.max(1, d)); self._clampDist(); }
        self._pinch = d;
        return;
      }
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      self._dragMoved += Math.abs(dx) + Math.abs(dy);
      self._yaw -= dx * 0.007;
      self._pitch += dy * 0.005;
      self._pitch = Math.max(-0.5, Math.min(0.75, self._pitch));
    });
    const up = function (e) {
      const wasDrag = self._ptr.has(e.pointerId);
      self._ptr.delete(e.pointerId);
      if (self._ptr.size < 2) self._pinch = 0;
      if (wasDrag && self._dragMoved < 6 && self._ptr.size === 0) self.onHit("body");
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", function (e) { e.preventDefault(); self._idleT = 0; self._dist *= (1 + (e.deltaY > 0 ? 0.12 : -0.12)); self._clampDist(); }, { passive: false });
  };
  MMD3D.prototype._pinchDist = function () {
    const a = Array.from(this._ptr.values());
    if (a.length < 2) return 0;
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };
  MMD3D.prototype._clampDist = function () { this._dist = Math.max(this._baseDist * 0.45, Math.min(this._baseDist * 2.6, this._dist)); };

  MMD3D.prototype.show = function () { this._visible = true; this.canvas.hidden = false; this._startLoop(); };
  MMD3D.prototype.hide = function () { this._visible = false; this.canvas.hidden = true; const hint = document.getElementById("stageHint"); if (hint) hint.hidden = true; };

  MMD3D.prototype.setInsets = function (top, bottom) { this._insetTop = top || 0; this._insetBottom = bottom || 0; this.layout(); };
  MMD3D.prototype.layout = function () {
    if (!this._renderer || !this._model) return;
    const W = this.canvas.clientWidth || root.innerWidth;
    const H = this.canvas.clientHeight || root.innerHeight;
    if (!W || !H) return;
    this._renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    const ratio = this._baseDist ? this._dist / this._baseDist : 1;
    this._computeFit();
    this._dist = this._baseDist * ratio;
  };
  MMD3D.prototype.setTransform = function (o) {
    if (o.scale != null) this._scale = o.scale;
    if (o.x != null) this._ux = o.x;
    if (o.y != null) this._uy = o.y;
    if (o.opacity != null) this._opacity = o.opacity;
    this._applyTransform();
  };
  MMD3D.prototype._applyTransform = function () {
    if (!this._model) return;
    this._model.scale.setScalar(this._scale);
    const op = this._opacity;
    this._model.traverse(function (o) {
      if (o.isMesh && o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(function (m) { m.transparent = op < 1; m.opacity = op; m.needsUpdate = true; });
      }
    });
  };
  MMD3D.prototype.setGaze = function (on) { this._gaze = !!on; };

  MMD3D.prototype.setMood = function (mood) {
    const map = { happy: "smile", excited: "smile", calm: null, shy: "shy", sad: "sad", angry: "angry", surprised: "surprised", thinking: null, neutral: null };
    this._mood = map[mood] || null;
    this._moodT = 0;
    if (mood === "happy" || mood === "excited") this.playGesture("bounce");
    else if (mood === "calm") this.playGesture("sway");
    else if (mood === "thinking") this.playGesture("think");
    else if (mood === "shy") this.playGesture("shy");
  };
  MMD3D.prototype.clearMood = function () { this._mood = null; };
  MMD3D.prototype.playGesture = function (name) {
    if (!name) return false;
    const g = GEST[name];
    if (!g || !g.tracks.length) return false;
    for (let i = 0; i < this._acts.length; i++) if (this._acts[i].name === name) return true;
    if (this._acts.length >= 2) return true;
    this._acts.push({ name: name, t: 0, dur: g.dur, tracks: g.tracks });
    return true;
  };
  MMD3D.prototype.stopAll = function () { this._acts.length = 0; this._mood = null; };

  /* 姿态（持续性）：arms=down|open|up|cross|hips, facing=front|left|right|back */
  MMD3D.prototype.setPosture = function (raw) {
    const p = { arms: "down", facing: "front" };
    if (raw) {
      String(raw).split(/[,;]+/).forEach(function (kv) {
        const m = kv.split("="); if (m.length !== 2) return;
        const k = m[0].trim().toLowerCase(), v = m[1].trim().toLowerCase();
        if (k === "arms" && ARMS[v]) p.arms = v;
        if (k === "facing" && FACING[v] != null) p.facing = v;
      });
    }
    this._posture = p;
  };
  MMD3D.prototype.setExpression = function () { /* 3D 用 mood/posture 驱动，忽略 Live2D 表情名 */ };

  MMD3D.prototype.setIdle = function (on) { this._idleOn = !!on; };
  MMD3D.prototype.setMouthScale = function (s) { this._mouthScale = s || 1; };
  MMD3D.prototype.setSpeaking = function (on) { this._speaking = !!on; if (!on) this._mouthTarget = 0; };
  MMD3D.prototype.setMouthLevel = function (v) { this._mouthTarget = Math.max(0, Math.min(1, v)); };
  MMD3D.prototype.setAudioDriven = function (b) { this._audioDriven = !!b; };

  MMD3D.prototype.getHeadAnchor = function () {
    if (!this._headScreen) return { x: root.innerWidth / 2, y: root.innerHeight * 0.26 };
    return this._headScreen;
  };

  MMD3D.prototype._startLoop = function () {
    if (this._raf) return;
    const self = this;
    const loop = function (now) { self._raf = requestAnimationFrame(loop); self._tick(now); };
    this._raf = requestAnimationFrame(loop);
  };

  MMD3D.prototype._tick = function (now) {
    if (!this._ready || !this._visible || this.canvas.hidden) { this._last = now; return; }
    let dt = (now - (this._last || now)) / 1000; this._last = now;
    if (!(dt > 0) || dt > 0.5) dt = 1 / 60;
    this._idleT += dt;

    if (this._speaking) {
      this._mouthSimT += dt;
      if (this._audioDriven !== true) this._mouthTarget = Math.min(1, 0.2 + 0.6 * Math.abs(Math.sin(this._mouthSimT * 9.1)) * (0.6 + 0.4 * Math.random()));
    }
    this._mouthLevel += (this._mouthTarget - this._mouthLevel) * Math.min(1, dt * 16);

    this._breath = (this._breath || 0) + dt;
    // 闲置：慢转 + 不打断手动操作
    if (this._idleOn !== false && this._idleT > 2.5 && this._ptr.size === 0) this._yaw += dt * 0.16;

    this._drive(dt);
    this._render();
  };

  MMD3D.prototype._drive = function (dt) {
    const self = this;
    this._base.forEach(function (v, b) { b.rotation.x = v.x; b.rotation.y = v.y; b.rotation.z = v.z; });

    const rootD = { y: 0, ry: 0, rz: 0 };
    const morphAcc = {};
    const addBone = function (slot, axis, v) { const b = self._bones[slot]; if (b) b.rotation[axis] += v; };

    // 姿态：手臂平滑过渡到目标
    const tgt = ARMS[this._posture.arms] || ARMS.down;
    const k = Math.min(1, dt * 6);
    ["armL", "armR"].forEach(function (s) {
      self._armsCur[s].z += (tgt[s].z - self._armsCur[s].z) * k;
      self._armsCur[s].x += (tgt[s].x - self._armsCur[s].x) * k;
    });
    self._armsCur.eL += ((tgt.eL || 0) - self._armsCur.eL) * k;
    self._armsCur.eR += ((tgt.eR || 0) - self._armsCur.eR) * k;

    // 情绪 morph
    if (this._mood != null && this._morphs[this._mood]) {
      this._moodT += dt;
      morphAcc[this._mood] = (morphAcc[this._mood] || 0) + ((this._mood === "smile") ? 0.5 : 0.68) * Math.min(1, this._moodT * 2);
    }

    // 动作
    for (let i = this._acts.length - 1; i >= 0; i--) {
      const a = this._acts[i];
      a.t += dt;
      const u = a.t / a.dur;
      if (u >= 1) { this._acts.splice(i, 1); continue; }
      for (let j = 0; j < a.tracks.length; j++) {
        const tr = a.tracks[j];
        const val = sample(tr.keys, u);
        if (tr.m) morphAcc[tr.m] = (morphAcc[tr.m] || 0) + val;
        else if (tr.b === "__root") rootD[tr.a] += val;
        else addBone(tr.b, tr.a, val);
      }
    }

    // 姿态手臂（在动作之后叠加，动作优先级更高的偏移仍生效）
    addBone("armL", "z", this._armsCur.armL.z - REST.armL.z);
    addBone("armR", "z", this._armsCur.armR.z - REST.armR.z);
    addBone("armL", "x", this._armsCur.armL.x);
    addBone("armR", "x", this._armsCur.armR.x);

    // 待机微动作
    if (this._idleOn !== false) {
      const t = this._breath;
      addBone("upper", "x", Math.sin(t * 1.6) * 0.03);
      addBone("head", "y", Math.sin(t * 0.7) * 0.02);
      addBone("head", "x", Math.sin(t * 1.1) * 0.012);
      addBone("lower", "z", Math.sin(t * 0.9) * 0.02);
      rootD.y += Math.sin(t * 1.6) * 0.05;
    }

    // 整体
    if (this._model) {
      const H = this._modelH || 20;
      const facing = FACING[this._posture.facing] || 0;
      this._model.position.set(this._ux * H * 0.35, (this._uy * H * 0.25) + rootD.y * H * 0.01, 0);
      this._model.rotation.y = facing + rootD.ry;
      this._model.rotation.z = rootD.rz;
    }

    // morph
    for (let i = 0; i < this._morphObjs.length; i++) {
      const infl = this._morphObjs[i].morphTargetInfluences;
      for (let j = 0; j < infl.length; j++) infl[j] = 0;
    }
    Object.keys(morphAcc).forEach(function (slot) {
      const m = self._morphs[slot]; if (!m) return;
      m.mesh.morphTargetInfluences[m.idx] = Math.max(0, Math.min(1, morphAcc[slot]));
    });
    // 眨眼
    if (this._morphs.blink && (!this._nextBlink || this._nextBlink < performance.now())) {
      this._nextBlink = performance.now() + 2200 + Math.random() * 3200;
      this._blinkStart = performance.now();
    }
    if (this._blinkStart) {
      const e = (performance.now() - this._blinkStart) / 150;
      if (e >= 1) this._blinkStart = 0;
      else { const v = e < 0.5 ? e * 2 : (1 - e) * 2; const m = this._morphs.blink; m.mesh.morphTargetInfluences[m.idx] = Math.max(m.mesh.morphTargetInfluences[m.idx], v); }
    }
    // 口型
    const mo = this._morphs.mouthOpen;
    if (mo) mo.mesh.morphTargetInfluences[mo.idx] = Math.max(0, Math.min(1, this._mouthLevel * 0.9 * this._mouthScale));
  };

  MMD3D.prototype._render = function () {
    const cam = this.camera, t = this._target, r = this._dist;
    const phi = Math.PI / 2 - this._pitch;
    cam.position.set(
      t.x + r * Math.sin(phi) * Math.sin(this._yaw),
      t.y + r * Math.cos(phi),
      t.z + r * Math.sin(phi) * Math.cos(this._yaw)
    );
    cam.lookAt(t);
    this._renderer.render(this.scene, cam);

    const head = this._bones.head || (this._skinned && this._skinned.skeleton.bones[0]);
    if (head) {
      const v = new THREE.Vector3();
      head.getWorldPosition(v);
      v.y += (this._modelH || 20) * 0.19;
      v.project(cam);
      const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
      this._headScreen = { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
      // 头部锚点变化时通知外层重新摆放气泡（带节流）
      const now = performance.now();
      if (this._anchorY == null || Math.abs(this._anchorY - this._headScreen.y) > 2) {
        this._anchorY = this._headScreen.y;
        if (!this._anchorT || now - this._anchorT > 120) { this._anchorT = now; this.onAnchor(); }
      }
    }
  };

  AnAn.MMD3D = MMD3D;
  AnAn.MMD3D.GESTURES = GEST;
  root.__mmdModuleReady = true;
})(window);
