// e2e/test.mjs v2 — 桌面端 + 移动端 + 深色模式 的真实浏览器验证
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
  const base = { locale: "zh-CN" };
  const ctxOpts = Object.assign(base, opts);
  return browser.newContext(ctxOpts).then(async (ctx) => {
    if (extra) await ctx.addInitScript(initSettings(extra));
    const page = await ctx.newPage();
    page.on("pageerror", (e) => diag.errors.push(String((e && e.stack) || e)));
    page.on("console", (m) => { if (m.type() === "error") diag.consoleErrors.push(m.text()); });
    return { ctx, page };
  });
}

const shot = (page, name) => page.screenshot({ path: `${outDir}/${tag}-${name}.jpg`, type: "jpeg", quality: 70 });
const clickEval = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);

async function waitReady(page, id) {
  await page.waitForFunction((want) => window.AnAn && window.AnAn.__ready === true && (!want || window.__ananModelId === want), id || null, { timeout: 150000 });
  await page.waitForFunction(() => window.__ananLoading === false, { timeout: 150000 }).catch(() => {});
}

try {
  /* ═══ 1. 桌面端 ═══ */
  const dset = K ? { baseUrl: B, apiKey: K, model: M, ttsEnabled: false, stream: true, showReasoning: false, autoTags: true, idleMotion: false, gaze: false, ctxWindow: 8000 } : { ttsEnabled: false };
  const { ctx: dctx, page: dp } = await makeCtx({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 }, dset);
  await dp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(dp);
  diag.steps.push("desktop-ready");
  await dp.waitForTimeout(1200);
  await shot(dp, "d1-loaded");

  diag.paramCount = await dp.evaluate(() => { try { return window.__anan.live2d.getParams().length; } catch (e) { return -1; } });
  diag.paramError = await dp.evaluate(() => window.__anan.live2d.paramError || null);
  diag.modelBounds = await dp.evaluate(() => { const b = window.__anan.live2d.model.getBounds(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), vw: innerWidth, vh: innerHeight }; });

  await dp.evaluate(() => window.__ananPlay("look_away"));
  await dp.waitForTimeout(600);
  diag.applied_lookaway = await dp.evaluate(() => { try { return window.__anan.live2d.engine.lastAdds; } catch (e) { return null; } });
  await shot(dp, "d2-gesture");

  // Edge TTS 探测
  diag.tts = await dp.evaluate(async () => {
    try { const t = window.__anan.tts; t.resume();
      const r = await t.speak("你好呀", { engine: "edge", edgeVoice: "zh-CN-XiaoxiaoNeural", rate: 1, pitch: 1, volume: 0 });
      return { engine: r && r.engine, last: t.lastEngine, voice: t.lastVoice || null, err: t.lastError || null };
    } catch (e) { return { error: String((e && e.message) || e) }; }
  });

  // 对话
  if (K && M) {
    await dp.fill("#chatInput", "你好，用一句话介绍自己，并在开头用动作标签表现出你很开心");
    await clickEval(dp, "#btnSend");
    await dp.waitForFunction(() => {
      const b = document.querySelector("#bubbleStack .bubble .txt");
      const m = document.querySelector("#feed .msg.ai");
      return (b && (b.textContent || "").length > 0) || (m && (m.textContent || "").length > 0);
    }, { timeout: 120000 }).catch(() => diag.steps.push("chat-timeout"));
    await dp.waitForTimeout(2500);
    await shot(dp, "d3-chat");
    diag.bubbleText = await dp.evaluate(() => { const b = document.querySelector("#bubbleStack .bubble .txt"); const m = document.querySelector("#feed .msg.ai"); return (b && b.textContent) || (m && m.textContent) || null; });
    diag.feedText = await dp.evaluate(() => Array.from(document.querySelectorAll("#feed .msg")).map(e => e.className.replace("msg ", "") + ":" + e.textContent));
    diag.mood = await dp.evaluate(() => window.__anan.mood);
    diag.historyLen = await dp.evaluate(() => { try { return JSON.parse(localStorage.getItem("anan.mem.v2")).anan.history.length; } catch (e) { return null; } });
    diag.lastReasoning = await dp.evaluate(() => (window.__anan.lastReasoning || "").slice(0, 80));

    // 长回复 → 应自动启用消息栏（mode A）
    await dp.fill("#chatInput", "用至少六句话详细介绍一下你自己");
    await clickEval(dp, "#btnSend");
    await dp.waitForFunction(() => document.querySelectorAll("#feed .msg.ai").length > 0, { timeout: 120000 }).catch(() => diag.steps.push("long-timeout"));
    await dp.waitForTimeout(2200);
    diag.feedMode = await dp.evaluate(() => ({ aiMsgs: document.querySelectorAll("#feed .msg.ai").length, headBubbles: document.querySelectorAll("#bubbleStack .bubble").length }));
    await shot(dp, "d5-long");

    // 记忆压缩
    diag.compact = await dp.evaluate(async () => {
      try {
        const s = JSON.parse(localStorage.getItem("anan.settings.v2") || "{}");
        const st = { summary: "", history: [] };
        for (let i = 0; i < 12; i++) st.history.push({ role: i % 2 ? "assistant" : "user", content: "这是第" + i + "条消息，用来测试记忆压缩。" + "内容内容内容内容内容内容内容内容内容内容" });
        const before = st.history.length;
        const llm = new window.AnAn.LLM({ baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model });
        const r = await window.AnAn.compact(llm, { ctxWindow: 2000, keepRecent: 2 }, st, "你是测试角色。");
        return { compacted: r.compacted, summaryLen: (st.summary || "").length, histBefore: before, histAfter: st.history.length, err: r.error || null };
      } catch (e) { return { err: String((e && e.message) || e) }; }
    });
  }

  // 切换模型 → 女仆
  diag.switch = await dp.evaluate(async () => {
    try { await window.__ananSwitch("maid"); return { ok: true, id: window.__ananModelId }; }
    catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  });
  await dp.waitForTimeout(2500);
  await shot(dp, "d4-maid");
  diag.maidParamCount = await dp.evaluate(() => { try { return window.__anan.live2d.getParams().length; } catch (e) { return -1; } });
  diag.maidHasArm = await dp.evaluate(() => { try { return window.__anan.live2d.coreModel.getParameterIndex("ParamArmR") !== -1; } catch (e) { return null; } });
  diag.maidBounds = await dp.evaluate(() => { const b = window.__anan.live2d.model.getBounds(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; });
  await dctx.close();

  /* ═══ 2. 移动端（响应式 / 溢出检查）═══ */
  const { ctx: mctx, page: mp } = await makeCtx({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { theme: "auto" });
  await mp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(mp);
  diag.steps.push("mobile-ready");
  await mp.waitForTimeout(1500);
  await shot(mp, "m1-loaded");
  diag.mobile = await mp.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) }; };
    return {
      vw: innerWidth, vh: innerHeight,
      docScrollW: document.documentElement.scrollWidth,
      dock: r("#dock"), feed: r("#feedWrap"), bar: r("#topbar"),
      model: (function () { try { const b = window.__anan.live2d.model.getBounds(); return { x: Math.round(b.x), w: Math.round(b.width), y: Math.round(b.y), h: Math.round(b.height) }; } catch (e) { return null; } })()
    };
  });
  // 触发一次气泡，检查气泡不越界
  await mp.evaluate(() => window.__ananPlay("nod"));
  await mp.waitForTimeout(300);
  await clickEval(mp, "#chatInput");
  await mctx.close();

  /* ═══ 3. 深色模式（白闪 / 主题）═══ */
  const { ctx: kctx, page: kp } = await makeCtx({ viewport: { width: 900, height: 800 } }, { theme: "dark", ttsEnabled: false });
  await kp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  const earlyBg = await kp.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  await waitReady(kp);
  await kp.waitForTimeout(1200);
  await shot(kp, "k1-dark");
  diag.dark = await kp.evaluate(() => ({
    htmlClass: document.documentElement.className,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    canvasBg: getComputedStyle(document.querySelector("#bg")).backgroundColor
  }));
  diag.darkEarlyBg = earlyBg;
  await kctx.close();
} catch (e) {
  diag.fatal = String((e && e.stack) || e);
  diag.steps.push("fatal");
}

fs.writeFileSync(`${outDir}/${tag}-diag.json`, JSON.stringify(diag, null, 2));
log(JSON.stringify(diag, null, 2).slice(0, 4500));
await browser.close();
