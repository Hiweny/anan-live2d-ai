// e2e/test.mjs v4 — 桌面端 + 移动端 + 深色模式 + 3D + 动作/闪屏实测
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

const shot = (page, name) => page.screenshot({ path: `${outDir}/${tag}-${name}.jpg`, type: "jpeg", quality: 68 });
const clickEval = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);

async function waitReady(page, id) {
  await page.waitForFunction((want) => window.AnAn && window.AnAn.__ready === true && (!want || window.__ananModelId === want), id || null, { timeout: 180000 });
  await page.waitForFunction(() => window.__ananLoading === false, { timeout: 180000 }).catch(() => {});
}

// 用 CDP 录屏抓帧（每 vsync 一帧），用于检测闪屏
async function screencast(ctx, page, name, ms, maxDim = 150) {
  const cdp = await ctx.newCDPSession(page);
  let n = 0;
  const frames = [];
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 55, maxWidth: maxDim, maxHeight: maxDim, everyNthFrame: 1 });
  cdp.on("Page.screencastFrame", async (f) => {
    try { fs.writeFileSync(`${outDir}/${tag}-${name}-${String(n).padStart(2, "0")}.jpg`, Buffer.from(f.data, "base64")); n++; } catch (e) {}
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch (e) {}
  });
  await page.waitForTimeout(ms);
  await cdp.send("Page.stopScreencast").catch(() => {});
  return n;
}

try {
  /* ═══ 1. 桌面端（Live2D：安An）═══ */
  const dset = K ? { baseUrl: B, apiKey: K, model: M, ttsEnabled: false, stream: true, showReasoning: false, autoTags: true, idleMotion: false, gaze: false, ctxWindow: 8000 } : { ttsEnabled: false };
  const { ctx: dctx, page: dp } = await makeCtx({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 }, dset);
  await dp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(dp);
  diag.steps.push("desktop-ready");
  await dp.waitForTimeout(1500);
  await shot(dp, "d1-loaded");

  diag.paramCount = await dp.evaluate(() => { try { return window.__anan.live2d.getParams().length; } catch (e) { return -1; } });

  /* 顶栏按钮可点 */
  diag.hit = await dp.evaluate(() => {
    const at = (sel) => { const e = document.querySelector(sel); if (!e) return { sel, got: null }; const r = e.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { sel, ok: !!(el && (el === e || e.contains(el))) }; };
    return { settings: at("#btnSettings"), mute: at("#btnMute") };
  });
  try { await dp.click("#btnSettings", { timeout: 5000 }); await dp.waitForSelector("#settings:not([hidden])", { timeout: 3000 }); diag.settingsOpen = true; await clickEval(dp, "[data-close]"); } catch (e) { diag.settingsOpen = false; }

  /* \ 分段 + <pose> 解析 */
  diag.parse = await dp.evaluate(() => {
    const r = window.AnAn.parseIntent("<mood>happy</mood><act>nod,smile</act>\n<pose>shy</pose>\n你好呀\\今天过得怎么样？\\我给你讲件有意思的事");
    return { parts: r.parts, mood: r.mood, acts: r.acts, poses: r.poses, poseRaw: r.poseRaw };
  });

  /* Live2D 内置表情实测：逐个切换截图（证明「内置动作」真的可用） */
  diag.live2dExpr = await dp.evaluate(() => {
    const out = {};
    try { const m = window.__anan.live2d.model; const mgr = m.internalModel.motionManager.expressionManager; out.defs = ((mgr && (mgr.definitions || mgr._definitions)) || []).map(d => d.Name); } catch (e) { out.err = String(e.message); }
    return out;
  });
  await dp.evaluate(() => window.__anan.live2d.setExpression("notebig"));
  await dp.waitForTimeout(500); await shot(dp, "d2-pose-notebig");
  await dp.evaluate(() => window.__anan.live2d.setExpression("shy"));
  await dp.waitForTimeout(500);
  diag.exprApplied = await dp.evaluate(() => { try { return { cur: window.__anan.live2d._expr, cheek: window.__anan.live2d.coreModel.getParameterValueById("ParamCheek") }; } catch (e) { return null; } });
  await shot(dp, "d2b-pose-shy");
  await dp.evaluate(() => window.__anan.live2d.setExpression("none"));

  /* 动作实测 */
  await dp.evaluate(() => window.__ananPlay("look_away"));
  await dp.waitForTimeout(500);
  diag.applied_lookaway = await dp.evaluate(() => { try { return window.__anan.live2d.engine.lastAdds; } catch (e) { return null; } });

  /* 对话 */
  if (K && M) {
    await dp.fill("#chatInput", "请用反斜杠\\把这句话分成三段，并在开头用动作标签表现开心");
    await clickEval(dp, "#btnSend");
    await dp.waitForFunction(() => window.__anan && window.__anan.busy === false, { timeout: 120000 }).catch(() => {});
    await dp.waitForTimeout(2000);
    diag.splitBubbles = await dp.evaluate(() => Array.from(document.querySelectorAll("#bubbleStack .bubble .txt")).map(e => e.textContent));
    diag.lastPoseTag = await dp.evaluate(() => { try { return window.__anan.live2d._expr; } catch (e) { return null; } });
    await shot(dp, "d3-chat");
  }

  /* 重载页面，确保没有卡住的对话状态，再做 3D 测试 */
  await dp.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(dp);
  await dp.waitForTimeout(800);

  /* ═══ 切换 3D（薄荷）═══ */
  try {
  diag.mmd = await dp.evaluate(async () => { try { await window.__ananSwitch("mint"); return { ok: true, kind: window.__ananKind, id: window.__ananModelId }; } catch (e) { return { ok: false, err: String((e && e.message) || e) }; } });
  await dp.waitForFunction(() => window.__ananLoading === false, { timeout: 180000 }).catch(() => {});
  await dp.waitForFunction(() => window.__anan && window.__anan.mmd && window.__anan.mmd._ready === true, { timeout: 180000 }).catch(() => diag.steps.push("mmd-not-ready"));
  await dp.waitForTimeout(2500);
  diag.mmdLoadError = await dp.evaluate(() => window.__ananLoadError || null);
  diag.mmdState = await dp.evaluate(() => { try { const c = document.getElementById("canvas3d"); return { ready: window.__anan.mmd._ready, vis: !c.hidden, w: c.width, h: c.height, modelH: Math.round(window.__anan.mmd._modelH || 0), bones: Object.keys(window.__anan.mmd._bones).filter(k => window.__anan.mmd._bones[k]), posture: window.__anan.mmd._posture }; } catch (e) { return { err: String((e && e.message) || e) }; } });
  diag.mmdMorphs = await dp.evaluate(() => { try { return Object.keys(window.__anan.mmd._morphs || {}); } catch (e) { return null; } });
  await shot(dp, "d6-3d-stand");        // 自然站姿（非 T-pose）

  /* 姿态实测 */
  await dp.evaluate(() => window.__anan.mmd.setPosture("arms=open,facing=left"));
  await dp.waitForTimeout(900); await shot(dp, "d6b-3d-pose");
  diag.mmdPosture = await dp.evaluate(() => window.__anan.mmd._posture);
  await dp.evaluate(() => window.__anan.mmd.setPosture("arms=up,facing=front"));
  await dp.waitForTimeout(900); await shot(dp, "d6c-3d-armsup");
  await dp.evaluate(() => window.__anan.mmd.setPosture(""));
  await dp.waitForTimeout(600);

  /* 全身体动作实测：转一圈 / 鞠躬 / 挥手 */
  await dp.evaluate(() => window.__ananPlay("turn_around"));
  await dp.waitForTimeout(1000); await shot(dp, "d7a-turn");
  await dp.waitForTimeout(1500);
  await dp.evaluate(() => window.__ananPlay("bow"));
  await dp.waitForTimeout(700); await shot(dp, "d7b-bow");
  await dp.waitForTimeout(1800);
  await dp.evaluate(() => window.__ananPlay("arm_wave"));
  await dp.waitForTimeout(600); await shot(dp, "d7c-wave");

  /* 拖动旋转 */
  const yaw0 = await dp.evaluate(() => (window.__anan.mmd ? window.__anan.mmd._yaw : 0));
  await dp.mouse.move(640, 400); await dp.mouse.down(); await dp.mouse.move(820, 360, { steps: 10 }); await dp.mouse.up();
  await dp.waitForTimeout(400);
  const yaw1 = await dp.evaluate(() => (window.__anan.mmd ? window.__anan.mmd._yaw : 0));
  diag.mmdDrag = { yaw0: +yaw0.toFixed(3), yaw1: +yaw1.toFixed(3), changed: Math.abs(yaw1 - yaw0) > 0.1 };
  } catch (e) { diag.mmdFatal = String((e && e.message) || e); }
  await dctx.close();

  /* ═══ 2. 移动端 ═══ */
  const { ctx: mctx, page: mp } = await makeCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { theme: "auto" });
  await mp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(mp);
  diag.steps.push("mobile-ready");
  await mp.waitForTimeout(1500);
  await shot(mp, "m1-loaded");
  diag.mobile = await mp.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) }; };
    return { vw: innerWidth, vh: innerHeight, docScrollW: document.documentElement.scrollWidth, dock: r("#dock"), bar: r("#topbar") };
  });
  await mctx.close();

  /* ═══ 3. 深色模式 + 闪屏录屏采样 ═══ */
  const { ctx: kctx, page: kp } = await makeCtx({ viewport: { width: 900, height: 800 } }, { theme: "dark", ttsEnabled: false });
  await kp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  const earlyBg = await kp.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const nFrames = await screencast(kctx, kp, "dark-flash", 3500);
  diag.flashFrames = nFrames;
  await waitReady(kp);
  await kp.waitForTimeout(800);
  await shot(kp, "k1-dark");
  diag.dark = await kp.evaluate(() => ({ htmlClass: document.documentElement.className, htmlBg: getComputedStyle(document.documentElement).backgroundColor }));
  diag.darkEarlyBg = earlyBg;
  await kctx.close();
} catch (e) {
  diag.fatal = String((e && e.stack) || e);
  diag.steps.push("fatal");
}

fs.writeFileSync(`${outDir}/${tag}-diag.json`, JSON.stringify(diag, null, 2));
log(JSON.stringify(diag, null, 2).slice(0, 5000));
await browser.close();
