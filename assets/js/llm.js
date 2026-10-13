/* ═══════════════════════════════════════════════════════════
   llm.js — OpenAI 兼容对话客户端 + 控制标签解析（防泄漏）
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  const MOOD_ALIAS = {
    happy: "happy", 开心: "happy", 高兴: "happy", 愉快: "happy",
    excited: "excited", 兴奋: "excited", 激动: "excited",
    calm: "calm", 平静: "calm", 放松: "calm",
    shy: "shy", 害羞: "shy", 羞涩: "shy",
    sad: "sad", 难过: "sad", 伤心: "sad", 低落: "sad",
    angry: "angry", 生气: "angry", 愤怒: "angry",
    surprised: "surprised", surprise: "surprised", 惊讶: "surprised", 吃惊: "surprised",
    thinking: "thinking", think: "thinking", 思考: "thinking",
    neutral: "neutral", 自然: "neutral", 平常: "neutral", 中性: "neutral"
  };
  const ACT_ALIAS = {
    nod: "nod", 点头: "nod", shake: "shake", 摇头: "shake", tilt: "tilt", 歪头: "tilt", 侧头: "tilt",
    look_away: "look_away", 移开视线: "look_away", 转头: "look_away", look_up: "look_up", 抬头看: "look_up",
    bounce: "bounce", 蹦跳: "bounce", 跳: "bounce", sway: "sway", 摇摆: "sway", 摇晃: "sway",
    surprise: "surprise", 惊: "surprise", 吃惊: "surprise", shy: "shy", 害羞: "shy",
    think: "think", 思考: "think", pout: "pout", 嘟嘴: "pout",
    smile: "smile", 微笑: "smile", 笑: "smile", laugh: "laugh", 大笑: "laugh",
    sad: "sad", 低落: "sad", angry: "angry", 生气: "angry",
    stretch: "stretch", 伸懒腰: "stretch", arm_wave: "arm_wave", 挥手: "arm_wave",
    arm_up: "arm_up", 举手: "arm_up", shrug: "shrug", 耸肩: "shrug", clap: "clap", 拍手: "clap"
  };
  const POSE_SET = {};
  ["none", "exp1", "down", "abb", "angry", "think", "writenote", "note", "notebig", "notelily",
   "armLup", "armL06", "shy", "shy2", "sur1", "sweat", "namida", "pale01", "pale02"].forEach(function (n) {
    POSE_SET[n.toLowerCase()] = n;
  });
  POSE_SET["无"] = "none"; POSE_SET["自然"] = "none";

  function normMood(s) { s = String(s).trim().toLowerCase(); return MOOD_ALIAS[s] || ""; }
  function normAct(s) { s = String(s).trim().toLowerCase(); return ACT_ALIAS[s] || ""; }
  function normPose(s) { s = String(s).trim(); return POSE_SET[s.toLowerCase()] || null; }
  function collectList(raw) { return String(raw).split(/[,，、\s|/]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function uniq(a) { const s = {}, r = []; a.forEach(function (x) { if (x && !s[x]) { s[x] = 1; r.push(x); } }); return r; }

  /* 解析回复：剥离全部控制标签（含残缺/未闭合），返回 {clean, mood, acts, poses} */
  AnAn.parseIntent = function (text) {
    let mood = "";
    const acts = [], poses = [], poseVals = [];
    let s = String(text == null ? "" : text);

    const setMood = function (v) { const m = normMood(v); if (m) mood = m; };
    const addAct = function (v) { collectList(v).forEach(function (a) { const n = normAct(a); if (n) acts.push(n); }); };
    const addPose = function (v) {
      // 保留原始写法（3D 姿态串需要），同时尝试映射为 Live2D 内置表情名
      String(v).split(/[+,，、\s]+/).forEach(function (a) { a = String(a).trim(); if (a) poseVals.push(a); });
      collectList(v).forEach(function (a) { const n = normPose(a); if (n) poses.push(n); });
    };

    // 0) MPL 自由骨骼指令 <bones>...</bones>（可跨行，内容含 ; 与逗号）
    let bonesRaw = "";
    s = s.replace(/<\s*bones\s*>([\s\S]*?)<\s*\/\s*bones\s*>/gi, function (m, body) { bonesRaw += " " + body; return ""; });
    s = s.replace(/<\s*\/?\s*bones\s*\/?\s*>/gi, "");

    // 1) 闭合标签 <tag>..</tag>（可跨行）
    s = s.replace(/<\s*([A-Za-z\u4e00-\u9fa5]+)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/g, function (m, tag, val) {
      const t = tag.toLowerCase();
      if (t === "mood" || t === "emotion" || tag === "情绪" || tag === "心情") setMood(val);
      else if (t === "act" || t === "action" || tag === "动作") addAct(val);
      else if (t === "pose" || tag === "姿势" || tag === "道具") addPose(val);
      return "";
    });
    // 2) 未闭合的标签（在开头一行内）
    s = s.replace(/^[ \t]*(?:<\s*(mood|emotion|act|action|pose)\s*[>:]?\s*([^\n<]*?)\s*(?:<\/[^>]*>)?[ \t]*\n)+/gi, function (m) {
      const re = /<\s*(mood|emotion|act|action|pose)\s*[>:]?\s*([^\n<]*?)\s*(?:<\/[^>]*>)?/gi;
      let g; while ((g = re.exec(m))) {
        const t = g[1].toLowerCase(), v = g[2];
        if (t === "mood" || t === "emotion") setMood(v);
        else if (t === "act" || t === "action") addAct(v);
        else if (t === "pose") addPose(v);
      }
      return "";
    });
    // 3) 任意残留的孤立标签记号
    s = s.replace(/<\/?\s*(mood|emotion|act|action|pose)\s*\/?>/gi, "");
    // 4) 方括号标签
    s = s.replace(/\[\s*(?:mood|emotion|心情|情绪)\s*[:=]\s*([^\]]+?)\s*\]/gi, function (m, v) { setMood(v); return ""; });
    s = s.replace(/\[\s*(?:act|action|动作)\s*[:=]\s*([^\]]+?)\s*\]/gi, function (m, v) { addAct(v); return ""; });
    s = s.replace(/\[\s*(?:pose|姿势|道具)\s*[:=]\s*([^\]]+?)\s*\]/gi, function (m, v) { addPose(v); return ""; });
    // 5) #EMOTION#xxx
    s = s.replace(/^\s*#\s*EMOTION\s*#\s*([A-Za-z\u4e00-\u9fa5]+)\s*$/gim, function (m, v) { setMood(v); return ""; });
    // 6) 代码围栏（模型偶尔包裹标签）
    s = s.replace(/^\s*```[a-z]*\s*$/gim, "");

    s = s.replace(/^[\s\n]+/, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "").trim();
    // 显式多气泡：用反斜杠 \（或全角 ＼）分隔，每段会成为一个独立气泡
    let parts = null;
    if (/[\\＼]/.test(s)) {
      const seg = s.split(/[\\＼]+/).map(function (x) { return x.replace(/[ \t]+$/gm, "").trim(); }).filter(Boolean);
      if (seg.length > 1) parts = seg;
    }
    const clean = parts ? parts.join("\n") : s;
    return { clean: clean, parts: parts, mood: mood, acts: uniq(acts).slice(0, 3), poses: uniq(poses).slice(0, 2), poseRaw: uniq(poseVals).slice(0, 4).join(","), bones: bonesRaw.trim() };
  };

  AnAn.guessMood = function (text) {
    const t = text || "";
    let best = "", score = 0;
    for (const mood in AnAn.EMOTION_KEYWORDS) {
      let s = 0;
      AnAn.EMOTION_KEYWORDS[mood].forEach(function (k) { if (t.indexOf(k) !== -1) s += 1; });
      if (s > score) { score = s; best = mood; }
    }
    return best;
  };

  /* ───────── 对话客户端 ───────── */
  function LLM(settings) { this.s = settings || {}; }
  LLM.prototype.configure = function (s) { this.s = s; };
  LLM.prototype._url = function () {
    let base = (this.s.baseUrl || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("请先在「设置 → AI 接口」填写 Base URL");
    if (!/\/chat\/completions$/.test(base)) base = base + "/chat/completions";
    return base;
  };

  LLM.prototype.test = async function () {
    const url = this._url();
    const body = { model: this.s.model, messages: [{ role: "user", content: "ping" }], max_tokens: 5 };
    const ctrl = new AbortController();
    const to = setTimeout(function () { ctrl.abort(); }, 15000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (this.s.apiKey || "") },
        body: JSON.stringify(body), signal: ctrl.signal
      });
      if (!res.ok) { const t = await res.text().catch(function () { return ""; }); throw new Error("HTTP " + res.status + " " + t.slice(0, 120)); }
      const j = await res.json();
      const c = j.choices && j.choices[0] && (j.choices[0].message || {}).content;
      return { ok: true, sample: c || "(空)" };
    } finally { clearTimeout(to); }
  };

  LLM.prototype.chat = async function (opts) {
    const url = this._url();
    const body = {
      model: this.s.model, messages: opts.messages,
      temperature: this.s.temperature == null ? 0.8 : this.s.temperature, stream: !!opts.stream
    };
    if (this.s.maxTokens > 0) body.max_tokens = this.s.maxTokens;

    const ctrl = new AbortController();
    const to = setTimeout(function () { ctrl.abort(); }, 120000);
    const headers = { "Content-Type": "application/json" };
    if (this.s.apiKey) headers["Authorization"] = "Bearer " + this.s.apiKey;

    let res;
    try { res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body), signal: ctrl.signal }); }
    catch (e) { clearTimeout(to); throw new Error("网络错误：无法连接接口（" + (e.message || e) + "）"); }
    if (!res.ok) { clearTimeout(to); const t = await res.text().catch(function () { return ""; }); throw new Error("接口返回 " + res.status + "：" + t.slice(0, 160)); }

    if (!opts.stream || !res.body || !res.body.getReader) {
      const j = await res.json(); clearTimeout(to);
      const m = (j.choices && j.choices[0] && (j.choices[0].message || {})) || {};
      const content = m.content || "", reasoning = m.reasoning_content || m.reasoning || "";
      if (reasoning) opts.onReasoning && opts.onReasoning(reasoning);
      if (content) opts.onContent && opts.onContent(content);
      opts.onDone && opts.onDone(content, reasoning);
      return { content: content, reasoning: reasoning };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", content = "", reasoning = "", done = false;
    try {
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buffer += decoder.decode(r.value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          line = line.replace(/\r$/, "");
          if (!line || line.indexOf("data:") !== 0) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") { done = true; break; }
          let j; try { j = JSON.parse(data); } catch (e) { continue; }
          const d = (j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message)) || {};
          if (d.reasoning_content) { reasoning += d.reasoning_content; opts.onReasoning && opts.onReasoning(d.reasoning_content, reasoning); }
          if (d.content) { content += d.content; opts.onContent && opts.onContent(d.content, content); }
        }
      }
    } catch (e) {
      clearTimeout(to);
      if (content) { opts.onDone && opts.onDone(content, reasoning); return { content: content, reasoning: reasoning }; }
      throw e;
    }
    clearTimeout(to);
    opts.onDone && opts.onDone(content, reasoning);
    return { content: content, reasoning: reasoning };
  };

  AnAn.LLM = LLM;
})(window);
