// e2e/test.mjs — 用真实无头浏览器打开页面，验证模型渲染、动作、以及 AI 驱动效果
import { chromium } from "playwright";
import fs from "fs";

const target = process.argv[2] || "http://localhost:8000";
const tag = process.argv[3] || "run";
const outDir = "e2e/out";
fs.mkdirSync(outDir, { recursive: true });

const diag = { target, tag, errors: [], consoleErrors: [], steps: [] };
const log = (...a) => console.log("[e2e]", ...a);

const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist"
  ]
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1, locale: "zh-CN" });
const page = await ctx.newPage();
page.on("pageerror", (e) => diag.errors.push(String((e && e.stack) || e)));
page.on("console", (m) => { if (m.type() === "error") diag.consoleErrors.push(m.text()); });

const K = process.env.TEST_API_KEY, B = process.env.TEST_API_BASE, M = process.env.TEST_API_MODEL;
diag.hasCreds = !!K;
if (K) {
  await ctx.addInitScript(([k, b, m]) => {
    try {
      localStorage.setItem("anan.settings.v1", JSON.stringify({
        baseUrl: b, apiKey: k, model: m, ttsEnabled: false, stream: true,
        showReasoning: true, autoTags: true, history: 8, modelScale: 1,
        idleMotion: false, gaze: false
      }));
    } catch (e) {}
  }, [K, B, M]);
}

const clickEval = async (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);

try {
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => window.AnAn && window.AnAn.__ready === true, { timeout: 150000 });
  diag.steps.push("model-ready");
  await page.evaluate(() => { const s = document.getElementById("settings"); if (s) s.hidden = true; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/${tag}-01-loaded.png` });

  diag.paramCount = await page.evaluate(() => { try { return window.__anan.live2d.getParams().length; } catch (e) { return -1; } });
  diag.paramError = await page.evaluate(() => window.__anan.live2d.paramError || null);
  diag.hasAngleX = await page.evaluate(() => { try { return window.__anan.live2d.coreModel.getParameterIndex("ParamAngleX") !== -1; } catch (e) { return null; } });
  diag.expressions = await page.evaluate(() => {
    try {
      const em = window.__anan.live2d.model.internalModel.motionManager.expressionManager;
      const d = em.definitions || em._definitions || [];
      return d.map((x) => x.Name);
    } catch (e) { return null; }
  });

  // 开始（解锁音频）—— 用 evaluate 点击，规避呼吸动画导致的稳定性检测
  await clickEval("#guardBtn");
  await page.waitForTimeout(1000);
  diag.guardHidden = await page.evaluate(() => document.getElementById("guard").hidden);
  await page.screenshot({ path: `${outDir}/${tag}-02-started.png` });

  // 触发动作并截图，读取“上一帧实际叠加量”作为数值证据
  await page.evaluate(() => window.__ananPlay("look_away"));
  await page.waitForTimeout(600);
  diag.applied_lookaway = await page.evaluate(() => { try { return window.__anan.live2d.engine.lastAdds; } catch (e) { return null; } });
  await page.screenshot({ path: `${outDir}/${tag}-03-gesture-lookaway.png` });

  await page.evaluate(() => window.__ananPlay("tilt"));
  await page.waitForTimeout(450);
  diag.applied_tilt = await page.evaluate(() => { try { return window.__anan.live2d.engine.lastAdds; } catch (e) { return null; } });
  await page.screenshot({ path: `${outDir}/${tag}-04-gesture-tilt.png` });

  // AI 对话（真实接口）
  if (K && M) {
    await page.fill("#chatInput", "你好，用一句话介绍自己，并在开头用动作标签表现出你很开心");
    await clickEval("#btnSend");
    await page.waitForFunction(() => {
      const b = document.getElementById("bubble");
      if (!b || b.dataset.state !== "show") return false;
      const t = b.querySelector('[data-role="text"]');
      return b.dataset.kind === "reply" && t && (t.textContent || "").length > 0;
    }, { timeout: 120000 }).catch(() => diag.steps.push("chat-timeout"));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${outDir}/${tag}-05-chat.png` });
    diag.bubbleText = await page.evaluate(() => { const t = document.querySelector('#bubble [data-role="text"]'); return t && t.textContent; });
    diag.mood = await page.evaluate(() => window.__anan.mood);
    diag.historyLen = await page.evaluate(() => window.__anan.history.length);
    diag.lastReasoning = await page.evaluate(() => (window.__anan.lastReasoning || "").slice(0, 120));
  }
} catch (e) {
  diag.fatal = String((e && e.stack) || e);
  diag.steps.push("fatal");
  try { await page.screenshot({ path: `${outDir}/${tag}-error.png` }); } catch (_) {}
}

fs.writeFileSync(`${outDir}/${tag}-diag.json`, JSON.stringify(diag, null, 2));
log(JSON.stringify(diag, null, 2).slice(0, 4000));
await browser.close();
