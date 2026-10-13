// e2e/test.mjs v3 — 桌面端 + 移动端 + 深色模式 + 3D 的真实浏览器验证
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

const shot = (page, name) => page.screenshot({ path: `${outDir}/${tag}-${name}.jpg`, type: "jpeg", quality: 68 });
const clickEval = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);

async function waitReady(page, id) {
  await page.waitForFunction((want) => window.AnAn && window.AnAn.__ready === true && (!want || window.__ananModelId === want), id || null, { timeout: 180000 });
  await page.waitForFunction(() => window.__ananLoading === false, { timeout: 180000 }).catch(() => {});
}

try {
  /* ═══ 1. 桌面端 ═══ */
  const dset = K ? { baseUrl: B, apiKey: K, model: M, ttsEnabled: false, stream: true, showReasoning: false, autoTags: true, idleMotion: false, gaze: false, ctxWindow: 8000 } : { ttsEnabled: false };
  const { ctx: dctx, page: dp } = await makeCtx({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 }, dset);
  await dp.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitReady(dp);
  diag.steps.push("desktop-ready");
  await dp.waitForTimeout(1500);
  await shot(dp, "d1-loaded");

  diag.paramCount = await dp.evaluate(() => { try { return window.__anan.live2d.getParams().length; } catch (e) { return -1; } });
  diag.modelBounds = await dp.evaluate(() => { const b = window.__anan.live2d.model.getBounds(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), vw: innerWidth, vh: innerHeight }; });

  /* — 关键修复：顶栏按钮必须可被真实点击（命中测试）— */
  diag.hit = await dp.evaluate(() => {
    const at = (sel) => {
      const e = document.querySelector(sel); if (!e) return { sel, got: null };
      const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const el = document.elementFromPoint(x, y);
      return { sel, got: el ? (el.id || el.className || el.tagName) : null, ok: !!(el && (el === e || e.contains(el))) };
    };
    return { settings: at("#btnSettings"), mute: at("#btnMute") };
  });
  try { await dp.click("#btnSettings", { timeout: 5000 }); await dp.waitForSelector("#settings:not([hidden])", { timeout: 3000 }); diag.settingsOpen = true; await clickEval(dp, "[data-close]"); }
  catch (e) { diag.settingsOpen = false; diag.settingsErr = String((e && e.message) || e).slice(0, 120); }

  /* — 静音（语音）按钮切换 — */
  diag.muteBefore = await dp.evaluate(() => localStorage.getItem("anan.settings.v2"));
  try { await dp.click("#btnMute", { timeout: 5000 }); diag.muteToggled = await dp.getAttribute("#btnMute", "aria-pressed"); }
  catch (e) { diag.muteErr = String((e && e.message) || e).slice(0, 120); }
  await clickEval(dp, "#btnMute"); // 复位

  /* — `\` 多气泡解析（确定性，不依赖网络）— */
  diag.split = await dp.evaluate(() => {
    const r = window.AnAn.parseIntent("<mood>happy</mood><act>nod,smile</act>\n你好呀\\今天过得怎么样？\\我给你讲件有意思的事");
    return { parts: r.parts, clean: r.clean, mood: r.mood, acts: r.acts };
  });

  await dp.evaluate(() => window.__ananPlay("look_away"));
  await dp.waitForTimeout(500);
  diag.applied_lookaway = await dp.evaluate(() => { try { return window.__anan.live2d.engine.lastAdds; } catch (e) { return null; } });
  await shot(dp, "d2-gesture");

  /* — 对话 — */
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

    // 让 AI 明确用 \ 分成多条（验证服务端是否照做）
    await dp.fill("#chatInput", "请用反斜杠\\把你的一句话分成三段，就像一句一句慢慢说");
    await clickEval(dp, "#btnSend");
    await dp.waitForFunction(() => window.__anan && window.__anan.busy === false, { timeout: 120000 }).catch(() => {});
    await dp.waitForTimeout(2500);
    diag.splitBubbles = await dp.evaluate(() => Array.from(document.querySelectorAll("#bubbleStack .bubble .txt")).map(e => e.textContent));
    await shot(dp, "d5-split");

    // 记忆压缩
    diag.compact = await dp.evaluate(async () => {
      try {
        const s = JSON.parse(localStorage.getItem("anan.settings.v2") || "{}");
        const st = { summary: "", history: [] };
        for (let i = 0; i < 12; i++) st.history.push({ role: i % 2 ? "assistant" : "user", content: "这是第" + i + "条消息，用来测试记忆压缩。" + "内容内容内容内容内容内容内容内容内容内容" });
        const llm = new window.AnAn.LLM({ baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model });
        const r = await window.AnAn.compact(llm, { ctxWindow: 2000, keepRecent: 2 }, st, "你是测试角色。");
        return { compacted: r.compacted, summaryLen: (st.summary || "").length, histAfter: st.history.length, err: r.error || null };
      } catch (e) { return { err: String((e && e.message) || e) }; }
    });
  }

  await dp.waitForFunction(() => window.__anan && window.__anan.busy === false, { timeout: 90000 }).catch(() => diag.steps.push("busy-wait-timeout"));
  await dp.waitForTimeout(600);

  /* — 切换 2D 模型：女仆 — */
  diag.switch = await dp.evaluate(async () => {
    try { await window.__ananSwitch("maid"); return { ok: true, id: window.__ananModelId }; }
    catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  });
  await dp.waitForTimeout(2500);
  await shot(dp, "d4-maid");
  diag.maidParamCount = await dp.evaluate(() => { try { return window.__anan.live2d.getParams().length; } catch (e) { return -1; } });
  diag.maidHasArm = await dp.evaluate(() => { try { return window.__anan.live2d.coreModel.getParameterIndex("ParamArmR") !== -1; } catch (e) { return null; } });
  // 女仆手臂动作是否真的产生了参数变化
  await dp.evaluate(() => window.__ananPlay("arm_wave"));
  await dp.waitForTimeout(500);
  diag.maidArmAdds = await dp.evaluate(() => { try { return window.__anan.live2d.engine.lastAdds; } catch (e) { return null; } });
  await shot(dp, "d4b-maid-arm");

  /* — 切换 3D 模型：薄荷 — */
  await dp.waitForFunction(() => window.__anan && window.__anan.busy === false, { timeout: 60000 }).catch(() => {});
  diag.mmd = await dp.evaluate(async () => {
    try { await window.__ananSwitch("mint"); return { ok: true, kind: window.__ananKind, id: window.__ananModelId }; }
    catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  });
  await dp.waitForFunction(() => window.__ananLoading === false, { timeout: 180000 }).catch(() => {});
  await dp.waitForFunction(() => window.__anan && window.__anan.mmd && window.__anan.mmd._ready === true, { timeout: 180000 }).catch(() => diag.steps.push("mmd-not-ready"));
  await dp.waitForTimeout(2500);
  diag.mmdLoadError = await dp.evaluate(() => window.__ananLoadError || null);
  diag.mmdModelId = await dp.evaluate(() => window.__ananModelId);
  diag.mmdState = await dp.evaluate(() => {
    try {
      const c = document.getElementById("canvas3d");
      return { ready: window.__anan.mmd._ready, vis: !c.hidden, w: c.width, h: c.height, modelH: Math.round(window.__anan.mmd._modelH || 0), hasHead: !!window.__anan.mmd._bones.head, morphObjs: (window.__anan.mmd._morphObjs || []).length };
    } catch (e) { return { err: String((e && e.message) || e) }; }
  });
  diag.mmdMorphs = await dp.evaluate(() => { try { return Object.keys(window.__anan.mmd._morphs || {}); } catch (e) { return null; } });
  await shot(dp, "d6-3d");
  // 拖动旋转
  const yaw0 = await dp.evaluate(() => window.__anan.mmd._yaw);
  await dp.mouse.move(640, 400); await dp.mouse.down(); await dp.mouse.move(820, 360, { steps: 10 }); await dp.mouse.up();
  await dp.waitForTimeout(400);
  const yaw1 = await dp.evaluate(() => window.__anan.mmd._yaw);
  diag.mmdDrag = { yaw0: +yaw0.toFixed(3), yaw1: +yaw1.toFixed(3), changed: Math.abs(yaw1 - yaw0) > 0.1 };
  await shot(dp, "d6b-3d-rotated");
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
    bodyBg: getComputedStyle(document.body).backgroundColor
  }));
  diag.darkEarlyBg = earlyBg;
  await kctx.close();
} catch (e) {
  diag.fatal = String((e && e.stack) || e);
  diag.steps.push("fatal");
}

fs.writeFileSync(`${outDir}/${tag}-diag.json`, JSON.stringify(diag, null, 2));
log(JSON.stringify(diag, null, 2).slice(0, 5000));
await browser.close();
