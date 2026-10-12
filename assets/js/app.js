/* ═══════════════════════════════════════════════════════════
   app.js — 界面与业务逻辑
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const AnAn = window.AnAn;
  const KEY = "anan.settings.v1";
  const HIST_KEY = "anan.history.v1";

  /* ── 设置存取 ── */
  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
    return Object.assign({}, AnAn.DEFAULTS, s);
  }
  function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  let S = loadSettings();

  const $ = function (id) { return document.getElementById(id); };
  const state = {
    history: [],
    busy: false,
    speaking: false,
    mood: "neutral",
    started: false,
    live2d: null,
    tts: new AnAn.TTS()
  };

  /* ── 主题 ── */
  function applyTheme() {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const dark = S.theme === "dark" || (S.theme === "auto" && mq.matches);
    document.body.classList.toggle("theme-dark", dark);
    document.body.classList.toggle("theme-light", !dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#12101c" : "#f7d7e6");
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (S.theme === "auto") applyTheme(); });

  /* ── 气泡 ── */
  const bubbleEl = $("bubble");
  const bubbleText = bubbleEl.querySelector('[data-role="text"]');
  const bubbleThinking = bubbleEl.querySelector(".bubble-thinking");
  const thinkingLabel = bubbleEl.querySelector(".thinking-label");
  let bubbleTimer = null;

  function positionBubble() {
    if (!state.live2d || !state.live2d.model) return;
    const a = state.live2d.getHeadAnchor();
    const w = bubbleEl.offsetWidth || 240;
    const pad = 14;
    let x = Math.max(w / 2 + pad, Math.min(window.innerWidth - w / 2 - pad, a.x));
    let y = Math.max(84, a.y);
    bubbleEl.style.left = x + "px";
    bubbleEl.style.top = y + "px";
  }
  function setBubble(kind, opts) {
    opts = opts || {};
    bubbleEl.dataset.kind = kind;
    if (opts.thinking) {
      bubbleThinking.hidden = false;
      bubbleText.hidden = true;
      if (thinkingLabel) thinkingLabel.textContent = opts.label || "思考中";
    } else {
      bubbleThinking.hidden = true;
      bubbleText.hidden = false;
      bubbleText.textContent = opts.text || "";
      if (opts.streaming) {
        const c = document.createElement("span"); c.className = "caret"; bubbleText.appendChild(c);
      }
    }
    bubbleEl.dataset.state = "show";
    positionBubble();
    if (bubbleTimer) { clearInterval(bubbleTimer); }
    bubbleTimer = setInterval(function () {
      if (bubbleEl.dataset.state !== "show") { clearInterval(bubbleTimer); bubbleTimer = null; return; }
      positionBubble();
    }, 600);
  }
  function hideBubble() { bubbleEl.dataset.state = "hidden"; }
  function autoHideBubble() {
    setTimeout(function () { if (!state.busy && !state.speaking) hideBubble(); }, 9000);
  }
  window.addEventListener("resize", positionBubble);

  /* ── 状态栏 ── */
  function setStatus(txt, st) {
    const el = $("statusText");
    el.textContent = txt;
    if (st) el.dataset.state = st; else delete el.dataset.state;
  }

  /* ── 快捷提问 ── */
  function buildChips() {
    const box = $("quickChips");
    box.innerHTML = "";
    if (!S.quickChips) { box.classList.add("hide"); return; }
    box.classList.remove("hide");
    AnAn.QUICK_CHIPS.forEach(function (t) {
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = t;
      b.onclick = function () { $("chatInput").value = t; send(); };
      box.appendChild(b);
    });
  }

  /* ── 应用设置到形象 ── */
  function applyLive() {
    if (!state.live2d) return;
    state.live2d.setTransform({ scale: S.modelScale, x: S.modelX, y: S.modelY, opacity: S.modelOpacity });
    state.live2d.setGaze(S.gaze);
    if (state.live2d.engine) {
      state.live2d.engine.setIdle(S.idleMotion);
      state.live2d.engine.setMouthScale(S.mouthScale);
    }
  }

  /* ── 系统提示词 ── */
  function systemPrompt() {
    let p = (S.persona && S.persona.trim()) ? S.persona : AnAn.DEFAULT_PERSONA;
    if (S.autoTags) p += AnAn.CONTROL_SPEC;
    return p;
  }
  function ttsCfg() {
    return {
      engine: S.ttsEngine,
      edgeVoice: S.edgeVoice,
      voice: S.ttsEngine === "openai" ? S.openaiTtsVoice : S.webspeechVoice,
      voiceName: S.webspeechVoice,
      rate: S.ttsRate, pitch: S.ttsPitch,
      volume: S.muted ? 0 : S.ttsVolume,
      model: S.openaiTtsModel,
      baseUrl: S.baseUrl, apiKey: S.apiKey,
      onFallback: function (msg) { setStatus(msg, ""); }
    };
  }

  /* ── 情绪 / 动作 ── */
  function applyMood(mood) {
    if (!mood || !AnAn.EMOTION_MAP[mood]) mood = "neutral";
    state.mood = mood;
    const map = AnAn.EMOTION_MAP[mood];
    state.live2d.engine.setMood(mood);
    state.live2d.setExpression(map.expression || "none");
  }

  /* ── 语音播放 + 口型 ── */
  function levelLoop() {
    if (!state.speaking) return;
    const useA = !!(state.tts._analyser && state.tts.lastEngine !== "webspeech");
    state.live2d.engine.setAudioDriven(useA);
    if (useA) state.live2d.engine.setMouthLevel(state.tts.level());
    requestAnimationFrame(levelLoop);
  }
  async function speak(text) {
    if (S.muted || !S.ttsEnabled || !text || !text.trim()) return;
    state.tts.resume();
    state.speaking = true;
    setStatus("说话中…", "speaking");
    state.live2d.engine.setSpeaking(true);
    requestAnimationFrame(levelLoop);
    try {
      await state.tts.speak(text, ttsCfg());
    } catch (e) { AnAn.log("TTS 异常", e); }
    state.speaking = false;
    state.live2d.engine.setSpeaking(false);
    setStatus("待机中");
    autoHideBubble();
  }

  /* ── 聊天主流程 ── */
  async function send() {
    const input = $("chatInput");
    const text = (input.value || "").trim();
    if (!text || state.busy) return;
    if (!S.baseUrl || !S.model) {
      setBubble("status", { text: "先去「设置 → AI 接口」填好 Base URL 和模型名称，我才能开口说话哦～" });
      openSettings("api");
      return;
    }
    input.value = ""; autosize();
    $("quickChips").classList.add("hide");
    state.busy = true;
    $("btnSend").disabled = true;

    state.history.push({ role: "user", content: text });
    applyMood("thinking");
    setStatus("思考中…", "thinking");
    setBubble("thinking", { thinking: true, label: "思考中" });

    const llm = new AnAn.LLM({
      baseUrl: S.baseUrl, apiKey: S.apiKey, model: S.model,
      temperature: S.temperature, maxTokens: S.maxTokens
    });
    let hist = state.history.slice(-1 - Math.max(0, S.history * 2));
    hist = hist.filter(function (m) { return m.role === "user" || m.role === "assistant"; });
    const messages = llm.buildMessages(systemPrompt(), hist.slice(0, hist.length - 1), text);

    let raw = "", gotContent = false, reasoningBuf = "";
    try {
      await llm.chat({
        messages: messages,
        stream: S.stream,
        onReasoning: function (d, full) {
          reasoningBuf = full;
          state.lastReasoning = full;
          if (S.showReasoning && !gotContent) {
            setBubble("thinking", { thinking: false, text: "💭 " + full });
            setStatus("思考中…", "thinking");
          }
        },
        onContent: function (d, full) {
          if (!gotContent) { gotContent = true; }
          raw = full;
          setBubble("reply", { text: full, streaming: true });
          setStatus("回复中…", "speaking");
        }
      });
    } catch (e) {
      state.busy = false; $("btnSend").disabled = false;
      setStatus("出错了");
      setBubble("status", { text: "唔…连接失败了：\n" + (e.message || e) });
      state.history.pop();
      $("quickChips").classList.remove("hide");
      return;
    }

    // 解析控制标签
    const parsed = AnAn.parseIntent(raw);
    let display = parsed.clean || raw || "";
    let mood = parsed.mood || AnAn.guessMood(display) || "neutral";
    state.history.push({ role: "assistant", content: display || "(无声)" });
    saveHistory();

    if (!display && !parsed.acts.length && !parsed.poses.length) display = "……（她沉默了一下）";
    setBubble("reply", { text: display });

    applyMood(mood);
    parsed.acts.forEach(function (a) { state.live2d.engine.playGesture(a); });
    parsed.poses.forEach(function (p) { state.live2d.setExpression(p); });

    // 记住姿态，稍后回归情绪表情
    setTimeout(function () {
      const map = AnAn.EMOTION_MAP[state.mood] || AnAn.EMOTION_MAP.neutral;
      state.live2d.setExpression(map.expression || "none");
    }, 4200);

    state.busy = false;
    $("btnSend").disabled = false;
    $("quickChips").classList.remove("hide");

    await speak(display);
    if (!state.speaking) { setStatus("待机中"); autoHideBubble(); }
  }

  /* ── 历史持久化 ── */
  function saveHistory() {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(state.history.slice(-40))); } catch (e) {}
  }
  function loadHistory() {
    try { state.history = JSON.parse(localStorage.getItem(HIST_KEY) || "[]") || []; } catch (e) { state.history = []; }
  }

  /* ── 输入框自适应高度 ── */
  function autosize() {
    const t = $("chatInput");
    t.style.height = "auto";
    t.style.height = Math.min(132, t.scrollHeight) + "px";
  }

  /* ── 点击互动 ── */
  function onHit(zone) {
    if (!S.clickReact || !state.live2d) return;
    const pool = zone === "head" ? ["shy", "tilt", "bounce", "surprise"]
      : zone === "body" ? ["nod", "sway", "smile"] : ["nod", "look_away", "tilt"];
    const g = pool[(Math.random() * pool.length) | 0];
    state.live2d.engine.playGesture(g);
    if (!state.busy && !state.speaking && Math.random() < 0.35) {
      const tips = ["呀…干嘛戳人家啦～", "嘿嘿，被你发现啦", "唔？找我吗？", "(≧▽≦) 被你摸到了", "诶嘿～"];
      setBubble("reply", { text: tips[(Math.random() * tips.length) | 0] });
      state.live2d.engine.setMood("shy");
      state.live2d.setExpression("shy");
      autoHideBubble();
    }
  }

  /* ── 设置面板绑定 ── */
  function openSettings(tab) {
    $("settings").hidden = false;
    if (tab) selectTab(tab);
  }
  function closeSettings() { $("settings").hidden = true; }
  function selectTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    document.querySelectorAll(".tab-page").forEach(function (p) { p.hidden = p.dataset.page !== name; });
  }

  function fillSettings() {
    $("setBaseUrl").value = S.baseUrl;
    $("setApiKey").value = S.apiKey;
    $("setModel").value = S.model;
    $("setTemp").value = S.temperature; $("outTemp").value = S.temperature;
    $("setMaxTokens").value = S.maxTokens; $("outMaxTokens").value = S.maxTokens || "默认";
    $("setStream").checked = S.stream;
    $("setReasoning").checked = S.showReasoning;

    $("setPersona").value = S.persona || AnAn.DEFAULT_PERSONA;
    $("setAutoTags").checked = S.autoTags;
    $("setHistory").value = S.history; $("outHistory").value = S.history + " 轮";
    $("setHistory2").value = S.history; $("outHistory2").value = S.history + " 轮";

    $("setTtsEnabled").checked = S.ttsEnabled;
    $("setTtsEngine").value = S.ttsEngine;
    $("setTtsRate").value = S.ttsRate; $("outTtsRate").value = S.ttsRate.toFixed(2) + "×";
    $("setTtsPitch").value = S.ttsPitch; $("outTtsPitch").value = S.ttsPitch.toFixed(2) + "×";
    $("setTtsVolume").value = S.ttsVolume; $("outTtsVolume").value = Math.round(S.ttsVolume * 100) + "%";
    $("setLipSync").checked = S.lipSync;
    $("setOpenaiTtsModel").value = S.openaiTtsModel;
    $("setOpenaiTtsVoice").value = S.openaiTtsVoice;

    $("setModelScale").value = S.modelScale; $("outModelScale").value = S.modelScale.toFixed(2);
    $("setModelX").value = S.modelX; $("outModelX").value = S.modelX.toFixed(2);
    $("setModelY").value = S.modelY; $("outModelY").value = S.modelY.toFixed(2);
    $("setModelOpacity").value = S.modelOpacity; $("outModelOpacity").value = Math.round(S.modelOpacity * 100) + "%";
    $("setGaze").checked = S.gaze;
    $("setIdleMotion").checked = S.idleMotion;
    $("setMouthScale").value = S.mouthScale; $("outMouthScale").value = S.mouthScale.toFixed(2);

    $("setTheme").value = S.theme;
    $("setTitle").value = S.title;
    $("setQuickChips").checked = S.quickChips;
    $("setClickReact").checked = S.clickReact;

    // 音色下拉
    fillVoices();
    syncTtsBlocks();
  }

  function fillVoices() {
    const ev = $("setEdgeVoice");
    if (ev.options.length === 0) {
      AnAn.EDGE_VOICES.forEach(function (v) {
        const o = document.createElement("option"); o.value = v.id; o.textContent = v.cn; ev.appendChild(o);
      });
    }
    ev.value = S.edgeVoice;
    const wv = $("setWebSpeechVoice");
    const voices = state.tts.webVoices();
    if (wv.options.length === 0 || voices.length) {
      const cur = wv.value;
      wv.innerHTML = "";
      const def = document.createElement("option"); def.value = ""; def.textContent = "（默认）"; wv.appendChild(def);
      voices.forEach(function (v) { const o = document.createElement("option"); o.value = v.name; o.textContent = v.name + " · " + v.lang; wv.appendChild(o); });
      wv.value = S.webspeechVoice || cur || "";
    }
  }
  function syncTtsBlocks() {
    document.querySelectorAll(".tts-engine-block").forEach(function (b) {
      b.hidden = b.dataset.engine !== S.ttsEngine;
    });
  }

  /* 通用绑定表 */
  const BIND = [
    ["setBaseUrl", "baseUrl", "text"],
    ["setApiKey", "apiKey", "text"],
    ["setModel", "model", "text"],
    ["setTemp", "temperature", "num", "outTemp"],
    ["setMaxTokens", "maxTokens", "num", "outMaxTokens"],
    ["setStream", "stream", "bool"],
    ["setReasoning", "showReasoning", "bool"],
    ["setAutoTags", "autoTags", "bool"],
    ["setHistory", "history", "num", "outHistory", "轮"],
    ["setHistory2", "history", "num", "outHistory2", "轮"],
    ["setTtsEnabled", "ttsEnabled", "bool"],
    ["setTtsEngine", "ttsEngine", "text"],
    ["setEdgeVoice", "edgeVoice", "text"],
    ["setWebSpeechVoice", "webspeechVoice", "text"],
    ["setOpenaiTtsModel", "openaiTtsModel", "text"],
    ["setOpenaiTtsVoice", "openaiTtsVoice", "text"],
    ["setTtsRate", "ttsRate", "num", "outTtsRate", "×"],
    ["setTtsPitch", "ttsPitch", "num", "outTtsPitch", "×"],
    ["setTtsVolume", "ttsVolume", "num", "outTtsVolume", "pct"],
    ["setLipSync", "lipSync", "bool"],
    ["setModelScale", "modelScale", "num", "outModelScale"],
    ["setModelX", "modelX", "num", "outModelX"],
    ["setModelY", "modelY", "num", "outModelY"],
    ["setModelOpacity", "modelOpacity", "num", "outModelOpacity", "pct"],
    ["setGaze", "gaze", "bool"],
    ["setIdleMotion", "idleMotion", "bool"],
    ["setMouthScale", "mouthScale", "num", "outMouthScale"],
    ["setTheme", "theme", "text"],
    ["setTitle", "title", "text"],
    ["setQuickChips", "quickChips", "bool"],
    ["setClickReact", "clickReact", "bool"]
  ];

  function wireBindings() {
    BIND.forEach(function (b) {
      const el = $(b[0]); if (!el) return;
      const key = b[1], type = b[2], out = b[3] ? $(b[3]) : null, unit = b[4];
      const fmt = function (v) {
        if (!out) return;
        if (unit === "pct") out.value = Math.round(v * 100) + "%";
        else if (unit === "轮") out.value = v + " 轮";
        else if (unit === "×") out.value = (+v).toFixed(2) + "×";
        else if (type === "num") out.value = (key === "maxTokens" && +v === 0) ? "默认" : (+v).toFixed ? (+v).toFixed(2) : v;
        else out.value = v;
      };
      el.addEventListener("input", function () {
        S[key] = type === "bool" ? el.checked : (type === "num" ? parseFloat(el.value) : el.value);
        if (b[0] === "setMaxTokens") S.maxTokens = parseInt(el.value, 10) || 0;
        if (b[0] === "setHistory" || b[0] === "setHistory2") {
          const other = b[0] === "setHistory" ? "setHistory2" : "setHistory";
          if ($(other)) { $(other).value = S.history; const oo = $(other === "setHistory" ? "outHistory" : "outHistory2"); if (oo) oo.value = S.history + " 轮"; }
        }
        fmt(S[key]);
        saveSettings();
        if (key === "theme") applyTheme();
        if (key === "quickChips") buildChips();
        if (key === "ttsEngine") syncTtsBlocks();
        if (["modelScale", "modelX", "modelY", "modelOpacity", "gaze", "idleMotion", "mouthScale"].indexOf(key) >= 0) applyLive();
        if (key === "title") { $("brandName").textContent = S.title || "安An"; document.title = (S.title || "安An") + " · AI 桌面伙伴"; }
      });
      el.addEventListener("change", function () { el.dispatchEvent(new Event("input")); });
    });
  }

  function wireSettingsUI() {
    document.querySelectorAll(".tab").forEach(function (t) { t.onclick = function () { selectTab(t.dataset.tab); }; });
    document.querySelectorAll("[data-close]").forEach(function (c) { c.onclick = closeSettings; });
    $("btnSettings").onclick = function () { openSettings(); };
    $("btnMask") && ($("btnMask").onclick = closeSettings);

    $("setPersona").addEventListener("input", function () { S.persona = $("setPersona").value; saveSettings(); });
    $("btnResetPersona").onclick = function () { S.persona = AnAn.DEFAULT_PERSONA; $("setPersona").value = S.persona; saveSettings(); };
    $("btnTestApi").onclick = async function () {
      const el = $("apiTestResult");
      el.className = "test-result"; el.textContent = "测试中…";
      const llm = new AnAn.LLM({ baseUrl: S.baseUrl, apiKey: S.apiKey, model: S.model });
      try { const r = await llm.test(); el.className = "test-result ok"; el.textContent = "✓ 连接成功：" + String(r.sample).slice(0, 40); }
      catch (e) { el.className = "test-result err"; el.textContent = "✗ " + (e.message || e); }
    };
    $("btnResetModel").onclick = function () {
      S.modelScale = AnAn.DEFAULTS.modelScale; S.modelX = AnAn.DEFAULTS.modelX; S.modelY = AnAn.DEFAULTS.modelY;
      S.modelOpacity = AnAn.DEFAULTS.modelOpacity; S.gaze = AnAn.DEFAULTS.gaze; S.idleMotion = AnAn.DEFAULTS.idleMotion;
      S.mouthScale = AnAn.DEFAULTS.mouthScale; saveSettings(); fillSettings(); applyLive();
    };
    $("btnTestMotion").onclick = function () {
      ["nod", "shake", "tilt", "bounce", "smile", "surprise", "shy", "think", "sad", "angry"].forEach(function (g, i) {
        setTimeout(function () { state.live2d.engine.playGesture(g); }, i * 700);
      });
    };
    $("btnClearHistory").onclick = function () {
      state.history = []; saveHistory();
      $("btnClearHistory").textContent = "已清空 ✓";
      setTimeout(function () { $("btnClearHistory").textContent = "清空对话记录"; }, 1500);
    };
    $("btnResetAll").onclick = function () {
      if (!confirm("恢复全部默认设置？（对话记录也会清空）")) return;
      S = Object.assign({}, AnAn.DEFAULTS);
      state.history = [];
      try { localStorage.removeItem(KEY); localStorage.removeItem(HIST_KEY); } catch (e) {}
      saveSettings(); applyTheme(); fillSettings(); applyLive(); buildChips();
      $("brandName").textContent = S.title;
    };
  }

  /* ── 启动 ── */
  async function boot() {
    applyTheme();
    loadHistory();
    buildChips();
    wireBindings();
    wireSettingsUI();
    fillSettings();

    $("brandName").textContent = S.title || "安An";
    $("guard").hidden = true;
    $("loading").hidden = false;

    const live2d = new AnAn.Live2D({
      canvas: $("live2d-canvas"),
      onProgress: function (p) {
        const pct = Math.round(p * 100);
        $("loaderBar").style.width = pct + "%";
        $("loaderPct").textContent = pct + "%";
      },
      onHit: onHit
    });
    state.live2d = live2d;

    try {
      await live2d.load();
    } catch (e) {
      $("loading").innerHTML = '<div class="loader"><div class="loader-text">模型加载失败 😢<br><small>' + (e.message || e) + "</small></div></div>";
      console.error(e);
      return;
    }

    $("loading").hidden = true;
    $("guard").hidden = false;
    applyLive();
    setStatus("待机中");

    // 测试/调试接口
    window.__anan = state;
    window.__ananPlay = function (n) { state.live2d.engine.playGesture(n); };
    window.AnAn.__ready = true;

    $("guardBtn").onclick = function () {
      $("guard").hidden = true;
      state.started = true;
      state.tts.resume();
      if (root_audio_ok()) {}
      // 欢迎语
      const hello = ["嗨～我是", "你来啦！我是", "你好呀，我是"][(Math.random() * 3) | 0];
      setBubble("reply", { text: hello + (S.title || "安An") + "，今天想聊点什么呀？(*ˊᵕˋ*)" });
      applyMood("happy");
      state.live2d.engine.playGesture("bounce");
      state.live2d.engine.playGesture("smile");
      autoHideBubble();
    };
    function root_audio_ok() {}
  }

  /* ── 事件 ── */
  function wireInput() {
    const input = $("chatInput");
    input.addEventListener("input", autosize);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $("btnSend").onclick = send;
    $("btnMute").onclick = function () {
      S.muted = !S.muted; saveSettings();
      $("btnMute").setAttribute("aria-pressed", String(S.muted));
      $("btnMute").querySelector(".ic-sound").hidden = S.muted;
      $("btnMute").querySelector(".ic-mute").hidden = !S.muted;
      if (S.muted) state.tts.stop();
    };
    $("btnMute").querySelector(".ic-mute").hidden = !S.muted;
    $("btnMute").querySelector(".ic-sound").hidden = S.muted;
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireInput();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { fillVoices(); };
    boot();
  });
})();
