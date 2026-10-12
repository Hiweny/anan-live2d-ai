/* ═══════════════════════════════════════════════════════════
   llm.js — OpenAI 兼容对话客户端 + 控制标签解析
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  /* ───────── 控制标签解析 ───────── */
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
    nod: "nod", 点头: "nod",
    shake: "shake", 摇头: "shake",
    tilt: "tilt", 歪头: "tilt", 侧头: "tilt",
    look_away: "look_away", 转头: "look_away",
    bounce: "bounce", 蹦跳: "bounce", 跳: "bounce",
    sway: "sway", 摇摆: "sway",
    surprise: "surprise", 惊: "surprise",
    shy: "shy", 害羞: "shy",
    think: "think", 思考: "think",
    pout: "pout", 嘟嘴: "pout",
    smile: "smile", 微笑: "smile", 笑: "smile",
    laugh: "laugh", 大笑: "laugh", 哈哈: "laugh",
    sad: "sad", 低落: "sad",
    angry: "angry", 生气: "angry",
    stretch: "stretch", 伸懒腰: "stretch"
  };
  const POSE_SET = {};
  ["none","exp1","down","abb","angry","think","writenote","note","notebig","notelily",
   "armLup","armL06","shy","shy2","sur1","sweat","namida","pale01","pale02"].forEach(function (n) {
    POSE_SET[n.toLowerCase()] = n === "smile" ? "none" : n;
  });
  POSE_SET["微笑"] = "none"; POSE_SET["无"] = "none";

  function normMood(s) { s = String(s).trim().toLowerCase(); return MOOD_ALIAS[s] || MOOD_ALIAS[s.replace(/\s/g, "")] || ""; }
  function normAct(s) { s = String(s).trim().toLowerCase(); return ACT_ALIAS[s] || ""; }
  function normPose(s) {
    s = String(s).trim();
    if (POSE_SET[s.toLowerCase()]) return POSE_SET[s.toLowerCase()];
    for (const k in POSE_SET) if (k.toLowerCase() === s.toLowerCase()) return POSE_SET[k];
    return null;
  }

  function collectList(raw) {
    return String(raw).split(/[,，、\s|/]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* 解析回复文本，剥离控制标签，返回 {clean, mood, acts, poses} */
  AnAn.parseIntent = function (text) {
    let mood = "", acts = [], poses = [];
    const out = { mood: "", acts: [], poses: [], clean: text };

    function take(re, assign) {
      out.clean = out.clean.replace(re, function (m, p1) { assign(p1); return ""; });
    }
    // <mood>x</mood>
    take(/<\s*mood\s*>([\s\S]*?)<\s*\/\s*mood\s*>/gi, function (v) { const m = normMood(v); if (m) mood = m; });
    take(/<\s*act(?:ion)?\s*>([\s\S]*?)<\s*\/\s*act(?:ion)?\s*>/gi, function (v) { collectList(v).forEach(function (a) { const n = normAct(a); if (n) acts.push(n); }); });
    take(/<\s*pose\s*>([\s\S]*?)<\s*\/\s*pose\s*>/gi, function (v) { collectList(v).forEach(function (a) { const n = normPose(a); if (n) poses.push(n); }); });
    // [mood:x] [emotion:x] [act:x] [action:x] [pose:x]
    take(/\[\s*(?:mood|emotion|心情|情绪)\s*[:=]\s*([^\]]+)\]/gi, function (v) { const m = normMood(v); if (m) mood = m; });
    take(/\[\s*(?:act|action|动作)\s*[:=]\s*([^\]]+)\]/gi, function (v) { collectList(v).forEach(function (a) { const n = normAct(a); if (n) acts.push(n); }); });
    take(/\[\s*(?:pose|道具|姿势)\s*[:=]\s*([^\]]+)\]/gi, function (v) { collectList(v).forEach(function (a) { const n = normPose(a); if (n) poses.push(n); }); });
    // #EMOTION#happy
    take(/^\s*#\s*EMOTION\s*#\s*([A-Za-z\u4e00-\u9fa5]+)\s*$/gim, function (v) { const m = normMood(v); if (m) mood = m; });

    // 清理残留空行
    out.clean = out.clean.replace(/^[\s\n]+/, "").replace(/\n{3,}/g, "\n\n");
    out.mood = mood;
    out.acts = uniq(acts);
    out.poses = uniq(poses);
    return out;
  };

  function uniq(a) { const s = {}, r = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; r.push(x); } }); return r; }

  /* 关键词兜底识别情绪 */
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

  LLM.prototype.buildMessages = function (persona, history, userText) {
    const sys = persona || "";
    const msgs = [{ role: "system", content: sys }];
    (history || []).forEach(function (m) { msgs.push({ role: m.role, content: m.content }); });
    msgs.push({ role: "user", content: userText });
    return msgs;
  };

  LLM.prototype._url = function () {
    let base = (this.s.baseUrl || "").trim().replace(/\/+$/, "");
    if (!base) throw new Error("请先在「设置 → AI 接口」填写 Base URL");
    if (!/\/chat\/completions$/.test(base)) base = base + "/chat/completions";
    return base;
  };

  /* 测试连接 */
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

  /* 对话：流式或整段。返回 {content, reasoning} */
  LLM.prototype.chat = async function (opts) {
    const self = this;
    const url = this._url();
    const body = {
      model: this.s.model,
      messages: opts.messages,
      temperature: this.s.temperature == null ? 0.8 : this.s.temperature,
      stream: !!opts.stream
    };
    if (this.s.maxTokens > 0) body.max_tokens = this.s.maxTokens;

    const ctrl = new AbortController();
    opts.signal = ctrl.signal;
    const to = setTimeout(function () { ctrl.abort(); }, 90000);

    const headers = { "Content-Type": "application/json" };
    if (this.s.apiKey) headers["Authorization"] = "Bearer " + this.s.apiKey;

    let res;
    try {
      res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (e) { clearTimeout(to); throw new Error("网络错误：无法连接接口（" + (e.message || e) + "）"); }
    if (!res.ok) {
      clearTimeout(to);
      const t = await res.text().catch(function () { return ""; });
      throw new Error("接口返回 " + res.status + "：" + t.slice(0, 160));
    }

    if (!opts.stream || !res.body || !res.body.getReader) {
      const j = await res.json();
      clearTimeout(to);
      const m = (j.choices && j.choices[0] && (j.choices[0].message || {})) || {};
      const content = m.content || "";
      const reasoning = m.reasoning_content || m.reasoning || "";
      if (content) opts.onContent && opts.onContent(content);
      if (reasoning) opts.onReasoning && opts.onReasoning(reasoning);
      opts.onDone && opts.onDone(content, reasoning);
      return { content: content, reasoning: reasoning };
    }

    // ── 流式解析 ──
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", content = "", reasoning = "";
    let done = false;
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
          if (d.reasoning_content !== undefined && d.reasoning_content !== null && d.reasoning_content !== "") {
            reasoning += d.reasoning_content;
            opts.onReasoning && opts.onReasoning(d.reasoning_content, reasoning);
          }
          if (d.content) {
            content += d.content;
            opts.onContent && opts.onContent(d.content, content);
          }
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
