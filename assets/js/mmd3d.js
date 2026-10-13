/* ═══════════════════════════════════════════════════════════
   mmd3d.js — 3D（MMD / PMX）控制器 v3
   Three.js + MMDLoader（无物理，纯程序化驱动）
   能力：拖动旋转 / 缩放 / 闲置慢转 / 手臂自动校准（换模型不再畸形）/
        全身大范围动作（头/颈/上半身/下半身/腿/整体位移与 360° 转身）/
        姿态（垂放・张开・平举・高举・抱臂・叉腰…）/ 表情 morph / 口型
   ─────────────────────────────────────────────────────────
   ★ 手臂自动校准：不同模型绑定姿态(A-pose/T-pose)不同，直接加固定角度
     会把手臂转进身体里（"胳膊没了"）。这里在加载时实测「肩→手」的
     绑定方向角 alpha，之后所有手臂姿态都以"目标夹角"描述，
     实际旋转 θ = 目标角 - alpha —— 任何模型都自然。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { MMDLoader } from "./lib/three/loaders/MMDLoader.js";

(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});
  const DEG = Math.PI / 180;

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
  /* 取到目标角的最短旋转差（处理 ±180° 回绕） */
  function angleDelta(cur, tgt) {
    let d = (tgt - cur) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /* 手臂姿态：以「相对水平向外」的夹角描述（度，按左臂给出；右臂镜像 = 180°-左）
     -90° = 自然垂下 / 0° = 水平张开(T) / +90° = 笔直高举 */
  const ARM_POSE = {
    down: { L: -78 },   // 自然垂放（与外向约 12°，自然且不贴进身体）
    open: { L: -46 },   // 轻轻张开
    T:    { L: -4 },    // 平举
    up:   { L: 74 },    // 举起
    high: { L: 88 }     // 高高举起
  };
  const FACING = { front: 0, left: Math.PI / 2, right: -Math.PI / 2, back: Math.PI };

  /* ── MPL 风格骨名别名（移植自 AmyangXYZ/MMD-MPL 语义骨名）── */
  const BONE_ALIAS = {
    head: "head", neck: "neck", upper_body: "upper", upperbody: "upper", body: "upper", chest: "upper", waist: "upper",
    lower_body: "lower", lowerbody: "lower", pelvis: "lower", hips: "lower", hip: "lower",
    center: "root", base: "root", root: "root",
    shoulder_l: "shoulderL", shoulder_r: "shoulderR",
    arm_l: "armL", arm_r: "armR", elbow_l: "elbowL", elbow_r: "elbowR",
    wrist_l: "handL", wrist_r: "handR", hand_l: "handL", hand_r: "handR",
    leg_l: "legL", leg_r: "legR", knee_l: "kneeL", knee_r: "kneeR",
    ankle_l: "footL", ankle_r: "footR", foot_l: "footL", foot_r: "footR"
  };
  /* 方向 → 旋转轴 / 符号 */
  const MPL_AXIS = { bend: "x", tilt: "x", turn: "y", rotate: "y", twist: "y", sway: "z", lean: "z" };
  const MPL_SIGN = { forward: 1, backward: -1, front: 1, back: -1, left: 1, right: -1, up: 1, down: -1 };

  /* ── 动作库 ────────────────────────────────────────────────
     tracks 三型：{b:骨骼槽, a:'x'|'y'|'z', keys}（弧度，叠加）
                {arm:'L'|'R', off:[[u,度],…]}（手臂夹角偏移）
                {m:morph名, keys}（表情）  {b:'__root',a:'x'|'y'|'z'|'ry'|'rz'}（整体） */
  const GEST = {
    idle: { dur: 0.4, tracks: [] },

    /* ── 头 / 颈 ── */
    nod: { dur: 1.0, tracks: [
      { b: "head", a: "x", keys: [[0, 0], [0.22, 0.30], [0.46, 0.03], [0.72, 0.14], [1, 0]] },
      { b: "neck", a: "x", keys: [[0, 0], [0.22, 0.10], [1, 0]] }] },
    nod_small: { dur: 0.8, tracks: [{ b: "head", a: "x", keys: [[0, 0], [0.3, 0.16], [0.7, 0.02], [1, 0]] }] },
    shake: { dur: 1.2, tracks: [
      { b: "head", a: "y", keys: [[0, 0], [0.2, 0.40], [0.42, -0.40], [0.64, 0.26], [0.84, -0.26], [1, 0]] }] },
    tilt: { dur: 1.2, tracks: [
      { b: "head", a: "z", keys: [[0, 0], [0.35, 0.42], [0.8, 0.32], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.4, -0.06], [1, 0]] }] },
    look_up: { dur: 1.8, tracks: [
      { b: "head", a: "x", keys: [[0, 0], [0.25, -0.50], [0.72, -0.40], [1, 0]] },
      { b: "neck", a: "x", keys: [[0, 0], [0.25, -0.16], [0.72, -0.12], [1, 0]] }] },
    look_down: { dur: 1.8, tracks: [
      { b: "head", a: "x", keys: [[0, 0], [0.25, 0.44], [0.72, 0.34], [1, 0]] },
      { b: "neck", a: "x", keys: [[0, 0], [0.25, 0.1], [1, 0]] }] },
    look_left: { dur: 1.8, tracks: [
      { b: "head", a: "y", keys: [[0, 0], [0.25, 0.74], [0.72, 0.66], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.3, 0.1], [1, 0]] }] },
    look_right: { dur: 1.8, tracks: [
      { b: "head", a: "y", keys: [[0, 0], [0.25, -0.74], [0.72, -0.66], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.3, -0.1], [1, 0]] }] },

    /* ── 上半身 / 腰 ── */
    bow: { dur: 2.0, tracks: [
      { b: "upper", a: "x", keys: [[0, 0], [0.3, 0.72], [0.66, 0.68], [1, 0]] },
      { b: "lower", a: "x", keys: [[0, 0], [0.3, -0.10], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, 0.22], [0.66, 0.2], [1, 0]] }] },
    bow_deep: { dur: 2.4, tracks: [
      { b: "upper", a: "x", keys: [[0, 0], [0.32, 1.15], [0.72, 1.1], [1, 0]] },
      { b: "lower", a: "x", keys: [[0, 0], [0.32, -0.16], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.32, 0.34], [0.72, 0.3], [1, 0]] },
      { b: "armL", a: "y", keys: [[0, 0], [0.32, -0.3], [1, 0]] },
      { b: "armR", a: "y", keys: [[0, 0], [0.32, 0.3], [1, 0]] }] },
    lean_back: { dur: 2.0, tracks: [
      { b: "upper", a: "x", keys: [[0, 0], [0.3, -0.42], [0.74, -0.36], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, -0.18], [1, 0]] }] },
    lean_left: { dur: 2.0, tracks: [
      { b: "__root", a: "rz", keys: [[0, 0], [0.3, 0.16], [0.74, 0.13], [1, 0]] },
      { b: "upper", a: "z", keys: [[0, 0], [0.3, 0.26], [0.74, 0.22], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.35, -0.16], [1, 0]] }] },
    lean_right: { dur: 2.0, tracks: [
      { b: "__root", a: "rz", keys: [[0, 0], [0.3, -0.16], [0.74, -0.13], [1, 0]] },
      { b: "upper", a: "z", keys: [[0, 0], [0.3, -0.26], [0.74, -0.22], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.35, 0.16], [1, 0]] }] },
    twist_left: { dur: 2.0, tracks: [
      { b: "upper", a: "y", keys: [[0, 0], [0.3, 0.62], [0.74, 0.56], [1, 0]] },
      { b: "lower", a: "y", keys: [[0, 0], [0.3, -0.26], [1, 0]] },
      { b: "head", a: "y", keys: [[0, 0], [0.3, 0.28], [1, 0]] }] },
    twist_right: { dur: 2.0, tracks: [
      { b: "upper", a: "y", keys: [[0, 0], [0.3, -0.62], [0.74, -0.56], [1, 0]] },
      { b: "lower", a: "y", keys: [[0, 0], [0.3, 0.26], [1, 0]] },
      { b: "head", a: "y", keys: [[0, 0], [0.3, -0.28], [1, 0]] }] },
    sway: { dur: 4.0, loop: true, tracks: [
      { b: "__root", a: "rz", keys: [[0, 0], [0.25, 0.055], [0.5, 0], [0.75, -0.055], [1, 0]] },
      { b: "upper", a: "z", keys: [[0, 0], [0.25, 0.05], [0.5, 0], [0.75, -0.05], [1, 0]] }] },

    /* ── 整体：转身 / 位移 / 蹦跳 ── */
    turn_left: { dur: 2.0, tracks: [{ b: "__root", a: "ry", keys: [[0, 0], [0.3, 1.5], [0.72, 1.5], [1, 0]] }] },
    turn_right: { dur: 2.0, tracks: [{ b: "__root", a: "ry", keys: [[0, 0], [0.3, -1.5], [0.72, -1.5], [1, 0]] }] },
    turn_around: { dur: 2.4, tracks: [{ b: "__root", a: "ry", keys: [[0, 0], [0.12, 0.2], [0.86, 6.48], [1, 6.48]] }] },
    spin: { dur: 3.0, loop: true, tracks: [{ b: "__root", a: "ry", keys: [[0, 0], [1, 6.2832]] }] },
    bounce: { dur: 1.0, tracks: [
      { b: "__root", a: "y", keys: [[0, 0], [0.24, 2.6], [0.5, -0.4], [0.76, 1.1], [1, 0]] },
      { b: "lower", a: "x", keys: [[0, 0], [0.24, -0.10], [1, 0]] }] },
    jump: { dur: 1.4, tracks: [
      { b: "__root", a: "y", keys: [[0, 0], [0.14, -1.2], [0.46, 7.5], [0.72, -0.5], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, -0.14], [1, 0]] },
      { arm: "L", off: [[0, 0], [0.5, 60], [0.72, 10], [1, 0]] },
      { arm: "R", off: [[0, 0], [0.5, 60], [0.72, 10], [1, 0]] }] },
    step: { dur: 1.6, tracks: [
      { b: "__root", a: "x", keys: [[0, 0], [0.4, 2.2], [0.8, 0.2], [1, 0]] },
      { b: "upper", a: "x", keys: [[0, 0], [0.4, 0.14], [1, 0]] },
      { b: "legL", a: "x", keys: [[0, 0], [0.35, 0.42], [0.7, -0.1], [1, 0]] },
      { b: "legR", a: "x", keys: [[0, 0], [0.35, -0.3], [0.7, 0.2], [1, 0]] }] },
    weight_shift: { dur: 2.6, tracks: [
      { b: "__root", a: "x", keys: [[0, 0], [0.3, 1.4], [0.7, -1.4], [1, 0]] },
      { b: "__root", a: "rz", keys: [[0, 0], [0.3, -0.05], [0.7, 0.05], [1, 0]] }] },
    crouch: { dur: 2.2, tracks: [
      { b: "__root", a: "y", keys: [[0, 0], [0.3, -4.6], [0.72, -4.2], [1, 0]] },
      { b: "upper", a: "x", keys: [[0, 0], [0.3, 0.34], [0.72, 0.3], [1, 0]] },
      { b: "kneeL", a: "x", keys: [[0, 0], [0.3, 0.5], [0.72, 0.46], [1, 0]] },
      { b: "kneeR", a: "x", keys: [[0, 0], [0.3, 0.5], [0.72, 0.46], [1, 0]] }] },
    kick: { dur: 1.4, tracks: [
      { b: "legR", a: "x", keys: [[0, 0], [0.25, -0.9], [0.5, -0.2], [1, 0]] },
      { b: "legL", a: "x", keys: [[0, 0], [0.25, 0.1], [1, 0]] }] },

    /* ── 手臂 ── */
    stretch: { dur: 2.2, tracks: [
      { arm: "L", off: [[0, 0], [0.3, 150], [0.82, 142], [1, 0]] },
      { arm: "R", off: [[0, 0], [0.3, 150], [0.82, 142], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, -0.2], [0.82, -0.14], [1, 0]] }] },
    arm_wave: { dur: 1.8, tracks: [
      { arm: "R", off: [[0, 0], [0.18, 150], [0.4, 118], [0.62, 150], [0.82, 118], [1, 0]] },
      { m: "smile", keys: [[0, 0], [0.25, 0.7], [0.75, 0.55], [1, 0]] }] },
    wave_both: { dur: 2.0, tracks: [
      { arm: "L", off: [[0, 0], [0.22, 158], [0.5, 132], [0.78, 158], [1, 0]] },
      { arm: "R", off: [[0, 0], [0.22, 158], [0.5, 132], [0.78, 158], [1, 0]] },
      { m: "smile", keys: [[0, 0], [0.25, 0.85], [0.8, 0.7], [1, 0]] }] },
    cheer: { dur: 1.8, tracks: [
      { arm: "L", off: [[0, 0], [0.26, 165], [0.7, 158], [1, 0]] },
      { arm: "R", off: [[0, 0], [0.26, 165], [0.7, 158], [1, 0]] },
      { b: "__root", a: "y", keys: [[0, 0], [0.3, 2.2], [0.62, 0], [1, 0]] },
      { m: "smile", keys: [[0, 0], [0.25, 1], [0.8, 0.85], [1, 0]] }] },
    arm_up: { dur: 1.6, tracks: [{ arm: "R", off: [[0, 0], [0.3, 155], [0.78, 146], [1, 0]] }] },
    point: { dur: 1.8, tracks: [
      { arm: "R", off: [[0, 0], [0.3, 92], [0.78, 86], [1, 0]] },
      { b: "armR", a: "y", keys: [[0, 0], [0.3, 0.5], [0.78, 0.45], [1, 0]] },
      { b: "head", a: "y", keys: [[0, 0], [0.3, -0.12], [1, 0]] }] },
    peace: { dur: 1.8, tracks: [
      { arm: "R", off: [[0, 0], [0.3, 138], [0.78, 130], [1, 0]] },
      { m: "smile", keys: [[0, 0], [0.3, 0.85], [0.78, 0.72], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.3, -0.1], [1, 0]] }] },
    salute: { dur: 1.8, tracks: [
      { arm: "R", off: [[0, 0], [0.3, 118], [0.78, 112], [1, 0]] },
      { b: "armR", a: "y", keys: [[0, 0], [0.3, 0.6], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, -0.08], [1, 0]] }] },
    arms_cross: { dur: 2.2, tracks: [
      { arm: "L", off: [[0, 0], [0.35, 34], [1, 0]] },
      { arm: "R", off: [[0, 0], [0.35, 34], [1, 0]] },
      { b: "armL", a: "y", keys: [[0, 0], [0.35, -0.85], [1, 0]] },
      { b: "armR", a: "y", keys: [[0, 0], [0.35, 0.85], [1, 0]] }] },
    hands_on_hips: { dur: 2.2, tracks: [
      { arm: "L", off: [[0, 0], [0.35, 20], [1, 0]] },
      { arm: "R", off: [[0, 0], [0.35, 20], [1, 0]] },
      { b: "armL", a: "y", keys: [[0, 0], [0.35, -0.45], [1, 0]] },
      { b: "armR", a: "y", keys: [[0, 0], [0.35, 0.45], [1, 0]] }] },
    clap: { dur: 1.5, tracks: [
      { b: "armL", a: "y", keys: [[0, 0], [0.2, -0.9], [0.4, -0.45], [0.6, -0.9], [0.8, -0.45], [1, 0]] },
      { b: "armR", a: "y", keys: [[0, 0], [0.2, 0.9], [0.4, 0.45], [0.6, 0.9], [0.8, 0.45], [1, 0]] },
      { m: "smile", keys: [[0, 0], [0.3, 0.65], [0.8, 0.55], [1, 0]] }] },
    shrug: { dur: 1.6, tracks: [
      { arm: "L", off: [[0, 0], [0.3, 6], [0.78, 3], [1, 0]] },
      { arm: "R", off: [[0, 0], [0.3, 6], [0.78, 3], [1, 0]] },
      { b: "elbowL", a: "z", keys: [[0, 0], [0.3, -0.9], [0.78, -0.85], [1, 0]] },
      { b: "elbowR", a: "z", keys: [[0, 0], [0.3, 0.9], [0.78, 0.85], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.3, 0.1], [1, 0]] }] },

    /* ── 情绪（含 morph）── */
    shy: { dur: 2.2, tracks: [
      { m: "shy", keys: [[0, 0], [0.3, 0.9], [0.8, 0.75], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, 0.24], [0.8, 0.18], [1, 0]] },
      { b: "head", a: "z", keys: [[0, 0], [0.4, 0.22], [0.8, 0.16], [1, 0]] },
      { b: "armL", a: "y", keys: [[0, 0], [0.35, -0.5], [0.85, -0.42], [1, 0]] },
      { b: "armR", a: "y", keys: [[0, 0], [0.35, 0.5], [0.85, 0.42], [1, 0]] }] },
    think: { dur: 2.6, tracks: [
      { b: "head", a: "z", keys: [[0, 0], [0.4, 0.2], [0.82, 0.15], [1, 0]] },
      { b: "head", a: "y", keys: [[0, 0], [0.4, -0.15], [0.82, -0.1], [1, 0]] },
      { arm: "R", off: [[0, 0], [0.4, 30], [0.82, 26], [1, 0]] },
      { b: "elbowR", a: "z", keys: [[0, 0], [0.4, 1.0], [0.82, 0.95], [1, 0]] }] },
    pout: { dur: 1.6, tracks: [{ b: "head", a: "z", keys: [[0, 0], [0.4, -0.12], [1, 0]] }, { m: "angry", keys: [[0, 0], [0.4, 0.35], [1, 0]] }] },
    smile: { dur: 1.8, tracks: [{ m: "smile", keys: [[0, 0], [0.3, 0.9], [0.74, 0.75], [1, 0]] }] },
    laugh: { dur: 1.7, tracks: [
      { m: "smile", keys: [[0, 0], [0.2, 1], [0.85, 1], [1, 0]] },
      { b: "__root", a: "y", keys: [[0, 0], [0.25, 1.6], [0.5, -0.2], [0.75, 0.9], [1, 0]] }] },
    sad: { dur: 2.4, tracks: [
      { m: "sad", keys: [[0, 0], [0.3, 0.9], [0.82, 0.7], [1, 0]] },
      { b: "head", a: "x", keys: [[0, 0], [0.3, 0.22], [0.82, 0.16], [1, 0]] }] },
    angry: { dur: 1.6, tracks: [
      { m: "angry", keys: [[0, 0], [0.2, 0.95], [0.78, 0.7], [1, 0]] },
      { b: "head", a: "y", keys: [[0, 0], [0.15, 0.08], [0.35, -0.08], [0.55, 0.05], [1, 0]] }] },
    surprise: { dur: 1.0, tracks: [
      { b: "head", a: "x", keys: [[0, 0], [0.12, -0.28], [0.5, -0.1], [1, 0]] },
      { b: "__root", a: "y", keys: [[0, 0], [0.15, 0.8], [1, 0]] },
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
    this._bones = {}; this._morphs = {}; this._morphObjs = []; this._calib = {};
    this._base = new Map();
    this._speaking = false; this._mouthLevel = 0; this._mouthTarget = 0; this._mouthSimT = 0; this._mouthScale = 1;
    this._posture = { arms: "down", facing: "front" };
    this._mpl = [];
    this._dbg = null;
    this._armsCur = { L: -1.36, R: 1.36, src: null };
    this._last = 0; this._raf = null;
    this.onProgress(0);
  }

  /* 骨骼匹配：优先精确名，其次前缀，再包含；并避开 IK / 捩 / ダミー / 布线骨骼 */
  MMD3D.prototype._findBone = function (skeleton, keys) {
    let best = null, bestScore = -1e9;
    for (let j = 0; j < skeleton.bones.length; j++) {
      const n = skeleton.bones[j].name;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        let s;
        if (n === k) s = 1000 - i * 10;
        else if (n.indexOf(k) === 0) s = 400 - i * 10;
        else if (n.indexOf(k) !== -1) s = 200 - i * 10;
        else continue;
        if (/[IKＩＫ]/.test(n) && !/[IKＩＫ]/.test(k)) s -= 500;
        if (/捩|ダミー|dummy|錘|MagicaCloth|Assist|Twist|Adjust|Collider/.test(n)) s -= 320;
        if (/D$|EX$|先$/.test(n)) s -= 160;
        if (s > bestScore) { bestScore = s; best = skeleton.bones[j]; }
      }
    }
    return best;
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
    this._bones = {}; this._base.clear(); this._calib = {};
    if (skinned) {
      const sk = skinned.skeleton;
      for (const slot in AnAn.MMD_BONES) this._bones[slot] = this._findBone(sk, AnAn.MMD_BONES[slot]);
      sk.bones.forEach(function (b) { self._base.set(b, { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z }); });

      /* ★ 手臂自动校准：实测「肩→手」绑定方向角 */
      model.updateMatrixWorld(true);
      const cfg = { L: { arm: "armL", tip: "handL", alt: "elbowL" }, R: { arm: "armR", tip: "handR", alt: "elbowR" } };
      ["L", "R"].forEach(function (side) {
        const ab = self._bones[cfg[side].arm];
        const tb = self._bones[cfg[side].tip] || self._bones[cfg[side].alt];
        if (!ab || !tb) { self._calib[side] = null; return; }
        const a = new THREE.Vector3(), t = new THREE.Vector3();
        ab.getWorldPosition(a); tb.getWorldPosition(t);
        const v = t.clone().sub(a);
        self._calib[side] = { alpha: Math.atan2(v.y, v.x), vx: v.x };
      });
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
    this._syncArms(true);

    this._ready = true;
    this._visible = true;
    this._last = performance.now();
    this._idleT = 3;
    this._startLoop();
    this.onProgress(1);
    root.__mmd3d = this;   // 调试/测试入口
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
    else if (mood === "angry") this.playGesture("arms_cross");
    else if (mood === "surprised") this.playGesture("surprise");
  };
  MMD3D.prototype.clearMood = function () { this._mood = null; };
  MMD3D.prototype.playGesture = function (name) {
    if (!name) return false;
    const g = GEST[name];
    if (!g || !g.tracks.length) return false;
    for (let i = 0; i < this._acts.length; i++) if (this._acts[i].name === name) return true;
    if (this._acts.length >= 3) return true;
    this._acts.push({ name: name, t: 0, dur: g.dur, tracks: g.tracks });
    return true;
  };
  MMD3D.prototype.stopAll = function () { this._acts.length = 0; this._mood = null; };

  /* 姿态（持续性）：arms=down|open|T|up|high, facing=front|left|right|back */
  MMD3D.prototype.setPosture = function (raw) {
    const p = { arms: "down", facing: "front" };
    if (raw) {
      String(raw).split(/[,;]+/).forEach(function (kv) {
        const m = kv.split("="); if (m.length !== 2) return;
        const k = m[0].trim().toLowerCase(), v = m[1].trim();
        if (k === "arms") { const vv = v.toLowerCase(); if (ARM_POSE[vv]) p.arms = vv; else if (ARM_POSE[v]) p.arms = v; }
        if (k === "facing" && FACING[v.toLowerCase()] != null) p.facing = v.toLowerCase();
      });
    }
    this._posture = p;
  };

  /* MPL 风格自由骨骼指令：形如 "arm_r bend forward 40; head turn left 20; leg_l bend forward 25;"
     任意骨骼 / 方向 / 角度（度），持续生效到下一次改变。让 AI 真正"接管"身体。 */
  MMD3D.prototype.setBones = function (text) {
    const list = [];
    if (text) {
      String(text).split(/[\n;。；]+/).forEach(function (seg) {
        seg = seg.trim(); if (!seg) return;
        let bone = null;
        seg.split(/[,，]+/).forEach(function (cl) {
          const tk = cl.trim().split(/\s+/); if (!tk.length) return;
          if (bone == null) { bone = tk[0].toLowerCase().replace(/[^a-z_]/g, ""); tk.shift(); }
          if (!bone || !tk.length) return;
          const action = tk[0].toLowerCase();
          if (action === "reset" || action === "clear") { list.push({ bone: bone, reset: true }); return; }
          let dir = "", amt = NaN;
          for (let i = 1; i < tk.length; i++) {
            const t = tk[i];
            if (/^-?\d+(\.\d+)?$/.test(t)) amt = parseFloat(t); else dir = t.toLowerCase();
          }
          list.push({ bone: bone, action: action, dir: dir, amt: (isNaN(amt) ? 30 : amt) });
        });
      });
    }
    this._mpl = list;
  };
  MMD3D.prototype.debugSet = function (slot, axis, val) { this._dbg = this._dbg || {}; this._dbg[slot + ":" + axis] = val; };
  MMD3D.prototype.setExpression = function () { /* 3D 用 mood/posture 驱动 */ };

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
    if (this._idleOn !== false && this._idleT > 2.5 && this._ptr.size === 0) this._yaw += dt * 0.16;
    /* 闲置时随机小动作，让角色"自己动起来" */
    if (this._idleOn !== false && this._idleT > 13 && this._ptr.size === 0) {
      this._idleT = 0;
      const pool = ["look_away", "tilt", "look_up", "look_down", "sway", "nod_small", "weight_shift"];
      this.playGesture(pool[Math.floor(Math.random() * pool.length)]);
    }

    this._drive(dt);
    this._render();
  };

  /* 依据当前姿态 + 校准，算出左右臂应加的 z 旋转（弧度）
     右臂目标角 = 180° - 左臂目标角（左右镜像），角度偏移在两臂上都是"抬升" */
  MMD3D.prototype._armTarget = function (side, posture, offDeg) {
    const base = ARM_POSE[posture] || ARM_POSE.down;
    const off = offDeg || 0;
    const deg = (side === "L") ? (base.L + off) : (180 - base.L - off);
    const calib = this._calib[side];
    const alpha = calib ? calib.alpha : (side === "L" ? 0 : Math.PI);
    return deg * DEG - alpha;
  };
  MMD3D.prototype._syncArms = function (instant) {
    ["L", "R"].forEach(function (side) {
      const th = this._armTarget(side, this._posture.arms, 0);
      if (instant) this._armsCur[side] = th;
    }, this);
  };

  MMD3D.prototype._drive = function (dt) {
    const self = this;
    this._base.forEach(function (v, b) { b.rotation.x = v.x; b.rotation.y = v.y; b.rotation.z = v.z; });

    const rootD = { x: 0, y: 0, z: 0, ry: 0, rz: 0 };
    const morphAcc = {};
    const armOff = { L: 0, R: 0 };
    const addBone = function (slot, axis, v) { const b = self._bones[slot]; if (b) b.rotation[axis] += v; };

    // 动作
    for (let i = this._acts.length - 1; i >= 0; i--) {
      const a = this._acts[i];
      a.t += dt;
      const u = a.t / a.dur;
      if (u >= 1) { this._acts.splice(i, 1); continue; }
      for (let j = 0; j < a.tracks.length; j++) {
        const tr = a.tracks[j];
        if (tr.arm) { armOff[tr.arm] += sample(tr.off, u); continue; }
        const val = sample(tr.keys, u);
        if (tr.m) morphAcc[tr.m] = (morphAcc[tr.m] || 0) + val;
        else if (tr.b === "__root") rootD[tr.a] = (rootD[tr.a] || 0) + val;
        else addBone(tr.b, tr.a, val);
      }
    }

    // MPL 自由骨骼（AI 直接接管任意骨骼/方向/角度）
    for (let i = 0; i < this._mpl.length; i++) {
      const it = this._mpl[i];
      if (it.reset) continue;
      const slot = BONE_ALIAS[it.bone] || it.bone;
      const amt = Math.max(-135, Math.min(135, it.amt));
      const sgn = MPL_SIGN[it.dir] || 1;
      const act = it.action;
      if (slot === "root" || act === "move" || act === "shift") {
        const d = it.dir, v = amt * 0.05;
        if (d === "up") rootD.y += v; else if (d === "down") rootD.y -= v;
        else if (d === "left") rootD.x -= v; else if (d === "right") rootD.x += v;
        else if (d === "backward" || d === "back") rootD.z += v; else if (d === "forward" || d === "front") rootD.z -= v;
        continue;
      }
      const isArm = (slot === "armL" || slot === "armR");
      if (isArm && (act === "raise" || act === "lift" || act === "bend")) {
        /* 手臂：bend backward / raise up = 抬臂；bend forward / raise down = 放下（沿用语义） */
        const up = (it.dir === "up" || it.dir === "backward" || it.dir === "back");
        armOff[slot === "armL" ? "L" : "R"] += up ? Math.abs(amt) : -Math.abs(amt);
        continue;
      }
      const axis = MPL_AXIS[act];
      if (axis) addBone(slot, axis, sgn * amt * DEG);
    }

    // 调试覆盖（轴向校准用）
    if (this._dbg) { for (const k in this._dbg) { const p = k.split(":"); addBone(p[0], p[1], this._dbg[k]); } }

    // 手臂：平滑到「姿态角 + 动作偏移」，消除换模型的畸形
    const k = Math.min(1, dt * 7);
    ["L", "R"].forEach(function (side) {
      const th = self._armTarget(side, self._posture.arms, armOff[side]);
      self._armsCur[side] += angleDelta(self._armsCur[side], th) * k;
    });
    addBone("armL", "z", this._armsCur.L);
    addBone("armR", "z", this._armsCur.R);

    // 情绪 morph
    if (this._mood != null && this._morphs[this._mood]) {
      this._moodT += dt;
      morphAcc[this._mood] = (morphAcc[this._mood] || 0) + ((this._mood === "smile") ? 0.5 : 0.68) * Math.min(1, this._moodT * 2);
    }

    // 待机微动作
    if (this._idleOn !== false) {
      const t = this._breath;
      addBone("upper", "x", Math.sin(t * 1.6) * 0.03);
      addBone("head", "y", Math.sin(t * 0.7) * 0.02);
      addBone("head", "x", Math.sin(t * 1.1) * 0.012);
      addBone("lower", "z", Math.sin(t * 0.9) * 0.02);
      rootD.y += Math.sin(t * 1.6) * 0.06;
    }

    // 整体
    if (this._model) {
      const H = this._modelH || 20;
      const u = H * 0.02;   // 单位化：1 ≈ 模型高度的 2%
      const facing = FACING[this._posture.facing] || 0;
      this._model.position.set(this._ux * H * 0.35 + (rootD.x || 0) * u, (this._uy * H * 0.25) + (rootD.y || 0) * u, (rootD.z || 0) * u);
      this._model.rotation.y = facing + (rootD.ry || 0);
      this._model.rotation.z = rootD.rz || 0;
    }

    // morph 清零 + 应用
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
      const now = performance.now();
      if (this._anchorY == null || Math.abs(this._anchorY - this._headScreen.y) > 2) {
        this._anchorY = this._headScreen.y;
        if (!this._anchorT || now - this._anchorT > 120) { this._anchorT = now; this.onAnchor(); }
      }
    }
  };

  AnAn.MMD3D = MMD3D;
  AnAn.MMD3D.GESTURES = GEST;
  AnAn.MMD3D.ARM_POSE = ARM_POSE;
  root.__mmdModuleReady = true;
})(window);
