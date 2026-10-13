// e2e/test.mjs v5 — 桌面端 + 移动端 + 深色模式 + 3D 动作矩阵 + 手臂校准 + 新模型 + 闪屏采样
import { chromium } from "playwright";
import fs from "fs";

const target = process.argv[2] || "http://localhost:8000";
const tag = process.argv[3] || "run";
const outDir = "e2e/out";
fs.mkdirSync(outDir, { recursive: true });

const diag = { target, tag, errors: [], consoleErrors: [], steps: [] };
const log = (...a) => console.log("[e2e]", ...a);
const K = process.env.TEST_API_KEY, B = process.env.TEST_API_BASE, M = process.env.TEST_API_MODEL;
diag.hasCreds = !!K;

const browser = await chromium.launch({
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader",
    "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
});

const initSettings = (extra) => `(() => { try {
  localStorage.setItem("anan.settings.v2", JSON.stringify(${JSON.stringify(extra)}));
} catch(e){} })()`;

function makeCtx(opts, extra) {
  const ctxOpts = Object.assign({ locale: "zh-CN" }, opts);
  return browser.newContext(ctxOpts).then(async (ctx) => {
    if (extra) await ctx.addInitScript(initSettings(extra));
    const page = await ctx.newPage();
    page.on("pageerror", (e) => diag.errors.push(String((e && e.stack) || e)));
    page.on("console", (m) => { if (m.type() === "error") diag.consoleErrors.push(m.text()); });
    return { ctx, page };
  });
}

const shot = (page, name) => page.screenshot({ path: `${outDir}/${tag}-${name}.jpg`, type: "jpeg", quality: 62 });
const clickEval = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);

async function waitReady(page, id) {
  await page.waitForFunction((want) => window.AnAn && window.AnAn.__ready === true && (!want || window.__ananModelId === want), id || null, { timeout: 180000 });
  await page.waitForFunction(() => window.__ananLoading === false, { timeout: 180000 }).catch(() => {});
}

async function screencast(ctx, page, name, ms, maxDim = 160) {
  const cdp = await ctx.newCDPSession(page);
  let n = 0;
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 50, maxWidth: maxDim, maxHeight: maxDim, everyNthFrame: 1 });
  cdp.on("Page.screencastFrame", async (f) => {
    try { fs.writeFileSync(`${outDir}/${tag}-${name}-${String(n).padStart(2, "0")}.jpg`, Buffer.from(f.data, "base64")); n++; } catch (e) {}
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch (e) {}
  });
  await page.waitForTimeout(ms);
  await cdp.send("Page.stopScreencast").catch(() => {});
  return n;
}

// 读左右手相对肩的世界坐标（用于客观判断"手臂是否真的在身侧/抬起"）
const POSE_PROBE = `(() => { try {
  const mm = window.__mmd3d; const B = (s,a) => (mm._bones[s] ? +mm._bones[s].rotation[a].toFixed(2) : null);
  return { headX:B("head","x"), headY:B("head","y"), headZ:B("head","z"), upperX:B("upper","x"), upperZ:B("upper","z"),
    lowerY:B("lower","y"), legL:B("legL","x"), kneeL:B("kneeL","x"), rootX:B("center","x"),
    armL:+mm._armsCur.L.toFixed(2), armR:+mm._armsCur.R.toFixed(2), posY:+mm._model.position.y.toFixed(2), rotY:+mm._model.rotation.y.toFixed(2) };
} catch (e) { return { err: String(e.message) }; } })()`;
const ARM_PROBE = `(() => {
  try {
    const mm = window.__mmd3d || (window.__anan && window.__anan.mmd);
    if (!mm || !mm._bones) return null;
    const V = mm._model.position.constructor;
    const gp = (b) => { const v = new V(); b.getWorldPosition(v); return v; };
    const H = mm._modelH || 20;
    const out = { H: Math.round(H), calib: mm._calib };
    ["L","R"].forEach(s => {
      const arm = mm._bones["arm"+s], hand = mm._bones["hand"+s] || mm._bones["elbow"+s];
      if (arm && hand) { const a = gp(arm), h = gp(hand); out[s] = { dx: +((h.x-a.x)/H).toFixed(3), dy: +((h.y-a.y)/H).toFixed(3), dz: +((h.z-a.z)/H).toFixed(3) }; }
    });
    return out;
  } catch (e) { return { err: String(e.message) }; }
})()`;

try {
  /* ═══ 1. 桌面端 Live2D ═══ */
  const dset = K ? { baseUrl: B, apiKey: K, model: M, ttsEnabled: false, stream: true, showReasoning: false, autoTags: true, idleMotion: false, gaze: false, ctxWindow: 8000 } : { ttsEnabled: false };
  const { ctx: dctx, page: dp } = await makeCtx({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 }, dset);
  await dp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(dp);
  diag.steps.push("desktop-ready");
  await dp.waitForTimeout(1200);
  await shot(dp, "d1-loaded");

  diag.hit = await dp.evaluate(() => {
    const at = (sel) => { const e = document.querySelector(sel); if (!e) return { sel, got: null }; const r = e.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { sel, ok: !!(el && (el === e || e.contains(el))) }; };
    return { settings: at("#btnSettings"), mute: at("#btnMute") };
  });
  try { await dp.click("#btnSettings", { timeout: 5000 }); await dp.waitForSelector("#settings:not([hidden])", { timeout: 3000 }); diag.settingsOpen = true; await clickEval(dp, "[data-close]"); } catch (e) { diag.settingsOpen = false; }

  diag.parse = await dp.evaluate(() => {
    const r = window.AnAn.parseIntent("<mood>happy</mood><act>nod,smile</act>\n<pose>shy</pose>\n你好呀\\今天过得怎么样？\\我给你讲件有意思的事");
    const rb = window.AnAn.parseIntent("<bones>arm_r bend forward 40; head turn left 20</bones>\n你好");
    return { parts: r.parts, mood: r.mood, acts: r.acts, poses: r.poses, poseRaw: r.poseRaw, bones: rb.bones, bonesClean: rb.clean };
  });
  diag.live2dExpr = await dp.evaluate(() => { try { const m = window.__anan.live2d.model; const mgr = m.internalModel.motionManager.expressionManager; return { defs: ((mgr && (mgr.definitions || mgr._definitions)) || []).map(d => d.Name) }; } catch (e) { return { err: String(e.message) }; } });
  await dp.evaluate(() => window.__anan.live2d.setExpression("shy"));
  await dp.waitForTimeout(400);
  diag.exprApplied = await dp.evaluate(() => { try { return { cur: window.__anan.live2d._expr, cheek: window.__anan.live2d.coreModel.getParameterValueById("ParamCheek") }; } catch (e) { return null; } });
  await shot(dp, "d2-pose-shy");
  await dp.evaluate(() => window.__anan.live2d.setExpression("none"));

  if (K && M) {
    await dp.fill("#chatInput", "请用反斜杠\\把这句话分成三段，并在开头用动作标签表现开心");
    await clickEval(dp, "#btnSend");
    await dp.waitForFunction(() => window.__anan && window.__anan.busy === false, { timeout: 120000 }).catch(() => {});
    await dp.waitForTimeout(1800);
    diag.splitBubbles = await dp.evaluate(() => Array.from(document.querySelectorAll("#bubbleStack .bubble .txt")).map(e => e.textContent));
    await shot(dp, "d3-chat");
  }
  await dctx.close();

  /* ═══ 2. 3D：手臂校准 + 姿态扫描 + 动作矩阵 ═══ */
  const { ctx: tctx, page: tp } = await makeCtx({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 }, { ttsEnabled: false, idleMotion: false });
  await tp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(tp);
  await tp.evaluate(async () => { await window.__ananSwitch("mint"); });
  await tp.waitForFunction(() => window.__anan && window.__anan.mmd && window.__anan.mmd._ready === true, { timeout: 180000 }).catch(() => diag.steps.push("mmd-not-ready"));
  await tp.waitForTimeout(1500);
  diag.mmd = await tp.evaluate(() => { try { const mm = window.__mmd3d; return { modelH: Math.round(mm._modelH), bones: Object.keys(mm._bones).filter(k => mm._bones[k]), morphs: Object.keys(mm._morphs) }; } catch (e) { return { err: String(e.message) }; } });
  diag.calib = await tp.evaluate(ARM_PROBE);
  await shot(tp, "d6-stand");

  // 手臂姿态扫描
  for (const p of ["down", "open", "T", "up", "high"]) {
    await tp.evaluate((pp) => window.__mmd3d.setPosture("arms=" + pp), p);
    await tp.waitForTimeout(900);
    diag["arm_" + p] = await tp.evaluate(ARM_PROBE);
    await shot(tp, "d10-arm-" + p);
  }
  await tp.evaluate(() => window.__mmd3d.setPosture("arms=down"));

  // 动作矩阵
  const acts = ["nod", "shake", "tilt", "look_left", "look_down", "bow", "bow_deep", "lean_left", "lean_back", "twist_left", "turn_left", "turn_around", "bounce", "jump", "step", "crouch", "kick", "stretch", "cheer", "point", "arms_cross", "hands_on_hips", "clap", "shy", "think"];
  const durs = await tp.evaluate(() => { const g = window.AnAn.MMD3D.GESTURES; const o = {}; for (const k in g) o[k] = g[k].dur; return o; });
  const actShot = {};
  for (const a of acts) {
    const ok = await tp.evaluate((n) => window.__mmd3d.playGesture(n), a);
    const d = (durs[a] || 1.5);
    await tp.waitForTimeout(Math.round(d * 1000 * 0.4));
    actShot[a] = ok;
    diag.actProbe = diag.actProbe || {};
    diag.actProbe[a] = await tp.evaluate(POSE_PROBE);
    await shot(tp, "d11-act-" + a);
    await tp.waitForTimeout(Math.round(d * 1000 * 0.55));
  }
  diag.actsPlayed = actShot;

  /* <bones> 自由骨骼（MPL 风格）实测 */
  await tp.evaluate(() => window.__mmd3d.setBones("arm_r raise up 70; arm_l raise up 70"));
  await tp.waitForTimeout(900); await shot(tp, "d13-bones-armsup");
  diag.bonesArms = await tp.evaluate(ARM_PROBE);
  await tp.evaluate(() => window.__mmd3d.setBones("head turn left 40; upper_body bend forward 25; leg_r bend forward 35"));
  await tp.waitForTimeout(900); await shot(tp, "d13-bones-mix");
  await tp.evaluate(() => window.__mmd3d.setBones(""));
  await tp.waitForTimeout(400);

  /* 拖动旋转 */
  const yaw0 = await tp.evaluate(() => window.__mmd3d._yaw);
  await tp.mouse.move(450, 420); await tp.mouse.down(); await tp.mouse.move(640, 380, { steps: 10 }); await tp.mouse.up();
  await tp.waitForTimeout(300);
  diag.drag = { yaw0: +yaw0.toFixed(3), yaw1: +(await tp.evaluate(() => window.__mmd3d._yaw)).toFixed(3) };

  /* 新模型：芙宁娜 / 星临者 */
  for (const id of ["fu", "star"]) {
    try {
      await tp.evaluate(async (i) => { await window.__ananSwitch(i); }, id);
      await tp.waitForFunction(() => window.__ananLoading === false, { timeout: 180000 }).catch(() => {});
      await tp.waitForFunction(() => window.__mmd3d && window.__mmd3d._ready === true, { timeout: 180000 }).catch(() => {});
      await tp.waitForTimeout(2500);
      diag["model_" + id] = await tp.evaluate(() => { try { const mm = window.__mmd3d; return { err: window.__ananLoadError || null, modelH: Math.round(mm._modelH), bones: Object.keys(mm._bones).filter(k => mm._bones[k]), morphs: Object.keys(mm._morphs), calib: mm._calib, id: window.__ananModelId }; } catch (e) { return { err: String(e.message) }; } });
      await shot(tp, "d12-" + id + "-stand");
      await tp.evaluate(() => window.__mmd3d.setPosture("arms=up"));
      await tp.waitForTimeout(900);
      diag["model_" + id + "_armup"] = await tp.evaluate(ARM_PROBE);
      await shot(tp, "d12-" + id + "-armup");
      await tp.evaluate(() => window.__mmd3d.setPosture("arms=down"));
    } catch (e) { diag["model_" + id] = { fatal: String((e && e.message) || e) }; }
  }
  await tctx.close();

  /* ═══ 3. 移动端 ═══ */
  const { ctx: mctx, page: mp } = await makeCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { theme: "auto" });
  await mp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(mp);
  diag.steps.push("mobile-ready");
  await mp.waitForTimeout(1200);
  await shot(mp, "m1-loaded");
  diag.mobile = await mp.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) }; };
    return { vw: innerWidth, vh: innerHeight, docScrollW: document.documentElement.scrollWidth, dock: r("#dock"), bar: r("#topbar") };
  });
  await mctx.close();

  /* ═══ 4. 深色模式：加载期 + 静置期 两次录屏（检测闪烁）═══ */
  const { ctx: kctx, page: kp } = await makeCtx({ viewport: { width: 900, height: 800 } }, { theme: "dark", ttsEnabled: false });
  await kp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  diag.darkEarlyBg = await kp.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  diag.flashFramesLoad = await screencast(kctx, kp, "dark-load", 3500);
  await waitReady(kp);
  await kp.waitForTimeout(1200);
  await shot(kp, "k1-dark");
  /* 静置期录屏（真正抓"背景闪烁"） */
  diag.flashFramesIdle = await screencast(kctx, kp, "dark-idle", 6000);
  diag.dark = await kp.evaluate(() => ({ htmlClass: document.documentElement.className, htmlBg: getComputedStyle(document.documentElement).backgroundColor, canvasBg: getComputedStyle(document.getElementById("live2d-canvas")).backgroundImage.slice(0, 40) }));
  await kctx.close();
} catch (e) {
  diag.fatal = String((e && e.stack) || e);
  diag.steps.push("fatal");
}

fs.writeFileSync(`${outDir}/${tag}-diag.json`, JSON.stringify(diag, null, 2));
log(JSON.stringify(diag, null, 2).slice(0, 6000));
await browser.close();
