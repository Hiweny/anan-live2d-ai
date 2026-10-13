/* ═══════════════════════════════════════════════════════════
   app.js — 界面与业务逻辑 v3（Live2D / 3D 双形象）
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const AnAn = window.AnAn;
  const KEY = "anan.settings.v2";
  const MEMKEY = "anan.mem.v2";

  const $ = (id) => document.getElementById(id);
  function loadSettings() {
    let v = {};
    try { v = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
    return Object.assign({}, AnAn.DEFAULTS, v);
  }
  function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function loadMemories() {
    let v = {};
    try { v = JSON.parse(localStorage.getItem(MEMKEY) || "{}") || {}; } catch (e) {}
    return v;
  }
  function saveMemories() {
    const slim = {};
    for (const k in MEM) { slim[k] = { history: MEM[k].history.slice(-60), summary: MEM[k].summary || "" }; }
    try { localStorage.setItem(MEMKEY, JSON.stringify(slim)); } catch (e) {}
  }
  function memOf(id) { if (!MEM[id]) MEM[id] = { history: [], summary: "" }; return MEM[id]; }

  let S = loadSettings();
  let MEM = loadMemories();
  let DEF = AnAn.getModel(S.modelId);

  const state = { busy: false, speaking: false, mood: "neutral", avatar: null, live2d: null, mmd: null, tts: new AnAn.TTS(), lastReasoning: "" };

  /* ── 主题 ── */
  function applyTheme() {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const dark = S.theme === "dark" || (S.theme === "auto" && mq.matches);
    const h = document.documentElement;
    h.classList.toggle("theme-dark", dark); h.classList.toggle("theme-light", !dark);
    h.style.backgroundColor = dark ? "#12101c" : "#f4eefb";
    h.style.colorScheme = dark ? "dark" : "light";
    const m = document.querySelector('meta[name="theme-color"]:not([media])');
    if (m) m.setAttribute("content", dark ? "#12101c" : "#f7d7e6");
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (S.theme === "auto") applyTheme(); });

  /* ── 视觉视口（移动端键盘：只移动输入栏，不缩放模型）── */
  function setupViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const upd = function () {
      document.documentElement.style.setProperty("--vvh", vv.height + "px");
      document.documentElement.style.setProperty("--vvt", vv.offsetTop + "px");
      // 只重排气泡位置，不改变模型 inset（避免键盘弹起时模型被压缩）
      layoutStack();
    };
    vv.addEventListener("resize", upd); vv.addEventListener("scroll", upd); upd();
  }

  /* ── 状态栏 ── */
  function setStatus(txt, st) { const el = $("statusText"); el.textContent = txt; if (st) el.dataset.state = st; else delete el.dataset.state; }

  /* ── 加载屏 ── */
  function showLoading() { $("loadName").textContent = DEF.name; $("loaderBar").style.width = "0%"; $("loaderPct").textContent = "0%"; $("loading").hidden = false; }
  function hideLoading() { $("loading").hidden = true; }
  function onProgress(p) { const pct = Math.round(p * 100); $("loaderBar").style.width = pct + "%"; $("loaderPct").textContent = pct + "%"; }

  /* ── 头顶气泡栈 ── */
  const stackEl = $("bubbleStack");
  const MAX_BUBBLES = 3;

  function headAnchor() { return state.avatar ? state.avatar.getHeadAnchor() : { x: window.innerWidth / 2, y: 200 }; }
  function layoutStack() {
    const a = headAnchor();
    const left = Math.max(120, Math.min(window.innerWidth - 120, a.x));
    stackEl.style.left = left + "px";
    stackEl.style.top = "auto";
    stackEl.style.bottom = (window.innerHeight - a.y) + "px";
    trimStack();
  }
  function trimStack() {
    const topbarH = $("topbar").getBoundingClientRect().height;
    const minTop = topbarH + 6;
    const b = stackEl.getBoundingClientRect();
    if (b.top < minTop && stackEl.children.length > 1) {
      const first = stackEl.firstElementChild;
      first.classList.add("out");
      setTimeout(function () { if (first.parentNode) first.parentNode.removeChild(first); }, 320);
    }
    while (stackEl.children.length > MAX_BUBBLES) {
      const first = stackEl.firstElementChild;
      if (first.parentNode) first.parentNode.removeChild(first);
    }
  }
  function addBubble(text, kind) {
    kind = kind || "reply";
    const el = document.createElement("div");
    el.className = "bubble pop" + (kind === "think" ? " think" : "");
    el.innerHTML = '<div class="txt"></div>';
    el.querySelector(".txt").textContent = text;
    stackEl.appendChild(el);
    layoutStack();
    return el;
  }
  function addThinkBubble(withText) {
    const el = document.createElement("div");
    el.className = "bubble think pop";
    if (withText) el.innerHTML = '<div class="txt"></div>';
    else el.innerHTML = '<div class="think-dots"><i></i><i></i><i></i></div>';
    stackEl.appendChild(el);
    layoutStack();
    return el;
  }
  function setBubbleText(el, t) { const c = el.querySelector(".txt"); if (c) c.textContent = t; }
  function clearBubbles() {
    const kids = [].slice.call(stackEl.children);
    kids.forEach(function (k) { k.classList.add("out"); setTimeout(function () { if (k.parentNode) k.parentNode.removeChild(k); }, 320); });
  }

  /* ── 消息区 ── */
  const feedEl = $("feed"), feedWrap = $("feedWrap");
  let feedTimer = null;
  function scheduleFeedHide() {
    if (feedTimer) clearTimeout(feedTimer);
    const sec = S.feedAutoHide;
    if (sec > 0) feedTimer = setTimeout(function () { feedWrap.classList.add("hide"); }, sec * 1000);
  }
  function feedShow() { feedWrap.classList.remove("hide"); }
  function feedClear() { feedEl.innerHTML = ""; }
  function feedAdd(role, text, opts) {
    opts = opts || {};
    const el = document.createElement("div");
    el.className = "msg " + role;
    el.dataset.role = role;
    el.textContent = text;
    if (opts.replace) {
      [].slice.call(feedEl.children).forEach(function (c) {
        if (c.dataset.role === role) { c.classList.add("out"); setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 300); }
      });
    }
    feedEl.appendChild(el);
    while (feedEl.children.length > 3) {
      const f = feedEl.firstElementChild;
      f.classList.add("out");
      setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 300);
      break;
    }
    feedShow(); scheduleFeedHide();
    return el;
  }

  /* ── 文案切分（标点兜底；优先用模型显式的 \ 分段）── */
  function splitSegments(text) {
    const s = String(text || "").replace(/\r/g, "");
    const parts = []; let cur = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]; cur += ch;
      if ("。！？!?…；;\n".indexOf(ch) >= 0) { parts.push(cur); cur = ""; }
      else if (cur.length >= 46) { parts.push(cur); cur = ""; }
    }
    if (cur) parts.push(cur);
    const seg = parts.map(function (x) { return x.trim(); }).filter(Boolean);
    const out = []; let acc = "";
    for (let i = 0; i < seg.length; i++) {
      if (acc.length + seg[i].length <= 36) acc += seg[i];
      else { if (acc) out.push(acc); acc = seg[i]; }
    }
    if (acc) out.push(acc);
    while (out.length > 6) { out[out.length - 2] = out[out.length - 2] + out[out.length - 1]; out.pop(); }
    return out.length ? out : [text];
  }

  /* ── 情绪/动作 ── */
  function applyMood(mood) {
    if (!AnAn.EMOTION_MAP[mood]) mood = "neutral";
    state.mood = mood;
    if (state.avatar) state.avatar.setMood(mood);
  }
  function applyActs(acts) { (acts || []).forEach(function (a) { state.avatar && state.avatar.playGesture(a); }); }
  function applyPoses(poses) { (poses || []).forEach(function (p) { state.avatar && state.avatar.setExpression(p); }); }

  /* ── 语音 ── */
  function levelLoop() {
    if (!state.speaking || !state.avatar) return;
    const useA = !!(state.tts._analyser && state.tts.lastEngine !== "webspeech");
    state.avatar.setAudioDriven(useA);
    if (useA) state.avatar.setMouthLevel(state.tts.level());
    requestAnimationFrame(levelLoop);
  }
  async function speak(text) {
    if (!S.ttsEnabled || !text || !text.trim() || !state.avatar) return;
    state.tts.resume();
    state.speaking = true; setStatus("说话中…", "speaking");
    state.avatar.setSpeaking(true);
    requestAnimationFrame(levelLoop);
    try {
      await state.tts.speak(text, {
        engine: S.ttsEngine,
        voice: S.ttsEngine === "openai" ? S.openaiTtsVoice : S.webspeechVoice,
        voiceName: S.webspeechVoice, rate: S.ttsRate, pitch: S.ttsPitch,
        volume: S.ttsVolume, model: S.openaiTtsModel, baseUrl: S.baseUrl, apiKey: S.apiKey,
        onFallback: function (m) { setStatus(m, ""); }
      });
    } catch (e) { AnAn.log("TTS 异常", e); }
    state.speaking = false;
    state.avatar.setSpeaking(false);
    setStatus("待机中");
  }

  /* ── 记忆 ── */
  function sysPrompt() {
    const p = (S.personaByModel && S.personaByModel[DEF.id]) || DEF.persona;
    return (S.autoTags ? p + AnAn.CONTROL_SPEC : p);
  }
  function updateCtxInfo() {
    const st = memOf(DEF.id);
    const t = AnAn.contextTokens(sysPrompt(), st, "");
    $("ctxInfo").textContent = "记忆 " + Math.round(t) + "/" + S.ctxWindow;
    if (!$("memTokens")) return;
    $("memTokens").textContent = Math.round(t);
    $("memBar").style.width = Math.min(100, t / S.ctxWindow * 100) + "%";
    $("memSub").textContent = "窗口 " + S.ctxWindow + " · 最近 " + S.keepRecent + " 轮原文 · 已存 " + st.history.length + " 条";
    const sum = $("setSummary");
    if (document.activeElement !== sum) sum.value = st.summary || "";
  }

  /* ── 聊天 ── */
  async function send() {
    const input = $("chatInput");
    const text = (input.value || "").trim();
    if (!text || state.busy) return;
    if (!S.baseUrl || !S.model) {
      addBubble("先去「设置 → AI 接口」填好 Base URL 和模型名称，我才能开口说话哦～", "reply");
      openModal("api"); return;
    }
    input.value = ""; autosize();
    state.busy = true; $("btnSend").disabled = true;
    clearBubbles();

    const st = memOf(DEF.id);
    st.history.push({ role: "user", content: text });
    saveMemories();
    updateCtxInfo();

    // 消息区：正常只放用户消息（一行，上一条消失）
    feedClear(); feedAdd("user", text, { replace: true });

    applyMood("thinking");
    setStatus("思考中…", "thinking");
    const thinkEl = addThinkBubble(S.showReasoning);

    if (AnAn.needCompact(sysPrompt(), st, S)) {
      try { await AnAn.compact(new AnAn.LLM({ baseUrl: S.baseUrl, apiKey: S.apiKey, model: S.model }), S, st, sysPrompt()); } catch (e) {}
    }

    const llm = new AnAn.LLM({ baseUrl: S.baseUrl, apiKey: S.apiKey, model: S.model, temperature: S.temperature, maxTokens: S.maxTokens });

    const messages = AnAn.buildContext(sysPrompt(), st, text);
    let raw = "";
    try {
      await llm.chat({
        messages: messages, stream: S.stream,
        onReasoning: function (d, full) { state.lastReasoning = full; if (S.showReasoning && thinkEl.parentNode) setBubbleText(thinkEl, "💭 " + full); },
        onContent: function (d, full) { raw = full; }
      });
    } catch (e) {
      if (thinkEl.parentNode) thinkEl.parentNode.removeChild(thinkEl);
      addBubble("唔…连接失败了：\n" + (e.message || e), "reply");
      st.history.pop(); saveMemories(); updateCtxInfo();
      state.busy = false; $("btnSend").disabled = false; setStatus("出错了");
      return;
    }

    const parsed = AnAn.parseIntent(raw);
    let display = parsed.clean || "";
    if (!display && !parsed.acts.length && !parsed.poses.length) display = "……（她沉默了一下）";
    const mood = parsed.mood || AnAn.guessMood(display) || "neutral";

    if (thinkEl.parentNode) { thinkEl.classList.add("out"); setTimeout(function () { if (thinkEl.parentNode) thinkEl.parentNode.removeChild(thinkEl); }, 320); }

    st.history.push({ role: "assistant", content: display });
    saveMemories();
    updateCtxInfo();

    applyMood(mood);
    applyActs(parsed.acts);
    applyPoses(parsed.poses);
    setStatus("回复中…", "speaking");

    // 分段：优先使用模型显式的 \ 分段
    const segs = (parsed.parts && parsed.parts.length > 1) ? parsed.parts : splitSegments(display);
    const useFeed = segs.length >= 4 || display.length > 130;
    if (useFeed) {
      clearBubbles();
      for (let i = 0; i < segs.length; i++) {
        await sleep(Math.min(2200, 260 + segs[i].length * 55));
        feedAdd("ai", segs[i]);
      }
    } else {
      for (let i = 0; i < segs.length; i++) {
        if (i > 0) await sleep(Math.min(2200, 300 + segs[i - 1].length * 55));
        addBubble(segs[i], "reply");
      }
    }

    state.busy = false; $("btnSend").disabled = false;
    await speak(display);
    if (!state.speaking) setStatus("待机中");
    scheduleFeedHide();
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ── 输入框 ── */
  function autosize() { const t = $("chatInput"); t.style.height = "auto"; t.style.height = Math.min(120, t.scrollHeight) + "px"; }

  /* ── 点击互动 ── */
  function onHit(zone) {
    if (!S.clickReact || !state.avatar) return;
    const pool = zone === "head" ? ["shy", "tilt", "bounce"] : zone === "body" ? ["nod", "sway", "smile"] : ["nod", "look_away", "tilt"];
    state.avatar.playGesture(pool[(Math.random() * pool.length) | 0]);
    if (!state.busy && !state.speaking && Math.random() < 0.3) {
      const tips = ["呀…干嘛戳人家啦～", "嘿嘿，被你发现啦", "唔？找我吗？", "(≧▽≦) 被你摸到了"];
      addBubble(tips[(Math.random() * tips.length) | 0], "reply");
      scheduleFeedHide();
    }
  }

  /* ── 布局 ── */
  function measureInsets() {
    const topbarH = $("topbar").getBoundingClientRect().height || 60;
    const dockH = $("dock").getBoundingClientRect().height || 90;
    const isPhone = window.innerWidth < 640;
    const bubbleReserve = isPhone ? 108 : 122;
    return { top: topbarH + bubbleReserve, bottom: dockH + 8 };
  }
  function layoutAll() {
    if (!state.avatar) return;
    const ins = measureInsets();
    state.avatar.setInsets(ins.top, ins.bottom);
    state.avatar.layout();
    layoutStack();
  }
  window.addEventListener("resize", function () { setTimeout(layoutAll, 60); });
  window.addEventListener("orientationchange", function () { setTimeout(layoutAll, 200); });

  /* ── 模型加载 / 切换 ── */
  function ensureAvatar(def) {
    if (def.kind === "mmd") {
      if (!AnAn.MMD3D) throw new Error("3D 模块尚未加载完成，请刷新页面重试");
      if (!state.mmd) state.mmd = new AnAn.MMD3D({ canvas: $("3d-canvas"), onProgress: onProgress, onHit: onHit });
      if (state.live2d) state.live2d.hide();
      state.mmd.show();
      return state.mmd;
    }
    if (!state.live2d) state.live2d = new AnAn.Live2D({ canvas: $("live2d-canvas"), onProgress: onProgress, onHit: onHit });
    if (state.mmd) state.mmd.hide();
    state.live2d.show();
    return state.live2d;
  }
  async function reloadModel(showLoad) {
    window.__ananLoading = true;
    if (showLoad) showLoading();
    try {
      state.avatar = ensureAvatar(DEF);
      await state.avatar.load(DEF);
    } catch (e) {
      window.__ananLoading = false; hideLoading();
      addBubble("模型加载失败 😢 " + ((e && e.message) || e), "reply");
      return;
    }
    hideLoading();
    applyLive();
    layoutAll();
    updateBrand();
    updateStageHint();
    window.__ananModelId = DEF.id;
    window.__ananKind = DEF.kind;
    window.__ananLoading = false;
  }
  function updateStageHint() {
    const hint = $("stageHint");
    if (!hint) return;
    hint.hidden = DEF.kind !== "mmd";
  }
  async function switchModel(id) {
    if (state.busy) return;
    if (id === DEF.id) return;
    S.modelId = id; saveSettings();
    DEF = AnAn.getModel(id);
    if (!MEM[id]) MEM[id] = { history: [], summary: "" };
    feedClear();
    clearBubbles();
    updateBrand();
    renderModelCards();
    fillPersona(); updateCtxInfo();
    await reloadModel(true);
    const g = DEF.greeting[(Math.random() * DEF.greeting.length) | 0];
    addBubble(g, "reply"); applyMood("calm");
  }
  function updateBrand() {
    $("brandName").textContent = DEF.name;
    $("brandTag").textContent = DEF.tag;
    document.title = DEF.name + " · AI 伙伴";
    $("chatInput").placeholder = "和" + DEF.name + "说点什么吧…";
  }

  /* ── 应用设置到形象 ── */
  function applyLive() {
    if (!state.avatar) return;
    state.avatar.setTransform({ scale: S.modelScaleAdjust, x: S.modelX, y: S.modelY, opacity: S.modelOpacity });
    state.avatar.setGaze(S.gaze);
    state.avatar.setIdle(S.idleMotion);
    state.avatar.setMouthScale(S.mouthScale);
  }

  /* ── 音频解锁 ── */
  function armAudioUnlock() {
    const once = function () { state.tts.resume(); window.removeEventListener("pointerdown", once); window.removeEventListener("keydown", once); };
    window.addEventListener("pointerdown", once); window.addEventListener("keydown", once);
  }

  /* ═══════════ 设置面板 ═══════════ */
  function openModal(tab) { $("settings").hidden = false; if (tab) selectTab(tab); updateCtxInfo(); }
  function closeModal() { $("settings").hidden = true; }
  function selectTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    document.querySelectorAll(".tab-page").forEach(function (p) { p.hidden = p.dataset.page !== name; });
  }
  function renderModelCards() {
    const box = $("modelCards"); box.innerHTML = "";
    AnAn.MODELS.forEach(function (m) {
      const c = document.createElement("div");
      c.className = "model-card" + (m.id === S.modelId ? " active" : "");
      c.innerHTML = '<span class="mc-dot' + (m.kind === "mmd" ? " k3d" : "") + '"></span><span><span class="mc-name">' + m.name + '</span><br><span class="mc-tag">' + m.tag + '</span></span>' +
        (m.id === S.modelId ? '<span class="mc-badge">使用中</span>' : "");
      c.onclick = function () { switchModel(m.id); };
      box.appendChild(c);
    });
  }
  function fillPersona() {
    if (!S.personaByModel) S.personaByModel = {};
    $("setPersona").value = S.personaByModel[DEF.id] || DEF.persona;
    $("personaTip").textContent = "这是「" + DEF.name + "」的「人格」，按模型独立保存。";
  }
  function fillVoices() {
    const wv = $("setWebSpeechVoice");
    const voices = state.tts.webVoices();
    if (!wv.options.length || voices.length) {
      const cur = wv.value; wv.innerHTML = "";
      const d = document.createElement("option"); d.value = ""; d.textContent = "（自动挑选中文音色）"; wv.appendChild(d);
      voices.forEach(function (v) { const o = document.createElement("option"); o.value = v.name; o.textContent = v.name + " · " + v.lang; wv.appendChild(o); });
      wv.value = S.webspeechVoice || cur || "";
    }
  }
  function syncTtsBlocks() { document.querySelectorAll(".tts-engine-block").forEach(function (b) { b.hidden = b.dataset.engine !== S.ttsEngine; }); }
  function syncMuteBtn() {
    const b = $("btnMute");
    b.setAttribute("aria-pressed", String(S.ttsEnabled));
    b.querySelector(".ic-sound").hidden = !S.ttsEnabled;
    b.querySelector(".ic-mute").hidden = S.ttsEnabled;
    b.title = S.ttsEnabled ? "关闭语音" : "开启语音";
  }
  function fillSettings() {
    $("setBaseUrl").value = S.baseUrl; $("setApiKey").value = S.apiKey; $("setModel").value = S.model;
    $("setTemp").value = S.temperature; $("outTemp").value = S.temperature;
    $("setMaxTokens").value = S.maxTokens; $("outMaxTokens").value = S.maxTokens || "默认";
    $("setStream").checked = S.stream; $("setReasoning").checked = S.showReasoning; $("setAutoTags").checked = S.autoTags;
    $("setModelScale").value = S.modelScaleAdjust; $("outModelScale").value = S.modelScaleAdjust.toFixed(2);
    $("setModelX").value = S.modelX; $("outModelX").value = S.modelX.toFixed(2);
    $("setModelY").value = S.modelY; $("outModelY").value = S.modelY.toFixed(2);
    $("setModelOpacity").value = S.modelOpacity; $("outModelOpacity").value = Math.round(S.modelOpacity * 100) + "%";
    $("setGaze").checked = S.gaze; $("setIdleMotion").checked = S.idleMotion;
    $("setMouthScale").value = S.mouthScale; $("outMouthScale").value = S.mouthScale.toFixed(2);
    $("setCtxWindow").value = S.ctxWindow; $("outCtxWindow").value = S.ctxWindow;
    $("setKeepRecent").value = S.keepRecent; $("outKeepRecent").value = S.keepRecent + " 轮";
    $("setTtsEnabled").checked = S.ttsEnabled; $("setTtsEngine").value = S.ttsEngine;
    $("setTtsRate").value = S.ttsRate; $("outTtsRate").value = (+S.ttsRate).toFixed(2);
    $("setTtsPitch").value = S.ttsPitch; $("outTtsPitch").value = (+S.ttsPitch).toFixed(2);
    $("setTtsVolume").value = S.ttsVolume; $("outTtsVolume").value = Math.round(S.ttsVolume * 100) + "%";
    $("setLipSync").checked = S.lipSync;
    $("setOpenaiTtsModel").value = S.openaiTtsModel; $("setOpenaiTtsVoice").value = S.openaiTtsVoice;
    $("setTheme").value = S.theme; $("setFeedAutoHide").value = S.feedAutoHide; $("outFeedAutoHide").value = S.feedAutoHide + "s";
    $("setClickReact").checked = S.clickReact;
    fillVoices(); syncTtsBlocks(); syncMuteBtn(); renderModelCards(); fillPersona(); updateCtxInfo();
  }

  const BIND = [
    ["setBaseUrl", "baseUrl", "text"], ["setApiKey", "apiKey", "text"], ["setModel", "model", "text"],
    ["setTemp", "temperature", "num", "outTemp"], ["setMaxTokens", "maxTokens", "num", "outMaxTokens"],
    ["setStream", "stream", "bool"], ["setReasoning", "showReasoning", "bool"], ["setAutoTags", "autoTags", "bool"],
    ["setModelScale", "modelScaleAdjust", "num", "outModelScale"], ["setModelX", "modelX", "num", "outModelX"],
    ["setModelY", "modelY", "num", "outModelY"], ["setModelOpacity", "modelOpacity", "num", "outModelOpacity", "pct"],
    ["setGaze", "gaze", "bool"], ["setIdleMotion", "idleMotion", "bool"], ["setMouthScale", "mouthScale", "num", "outMouthScale"],
    ["setCtxWindow", "ctxWindow", "num", "outCtxWindow"], ["setKeepRecent", "keepRecent", "num", "outKeepRecent"],
    ["setTtsEnabled", "ttsEnabled", "bool"], ["setTtsEngine", "ttsEngine", "text"],
    ["setWebSpeechVoice", "webspeechVoice", "text"], ["setOpenaiTtsModel", "openaiTtsModel", "text"],
    ["setOpenaiTtsVoice", "openaiTtsVoice", "text"], ["setTtsRate", "ttsRate", "num", "outTtsRate"],
    ["setTtsPitch", "ttsPitch", "num", "outTtsPitch"], ["setTtsVolume", "ttsVolume", "num", "outTtsVolume", "pct"],
    ["setLipSync", "lipSync", "bool"], ["setTheme", "theme", "text"], ["setFeedAutoHide", "feedAutoHide", "num", "outFeedAutoHide", "s"],
    ["setClickReact", "clickReact", "bool"]
  ];
  function wireBindings() {
    BIND.forEach(function (b) {
      const el = $(b[0]); if (!el) return;
      const key = b[1], type = b[2], out = b[3] ? $(b[3]) : null, unit = b[4];
      const fmt = function () {
        if (!out) return;
        const v = S[key];
        if (unit === "pct") out.value = Math.round(v * 100) + "%";
        else if (unit === "s") out.value = v + "s";
        else if (b[0] === "setKeepRecent") out.value = v + " 轮";
        else if (b[0] === "setMaxTokens") out.value = v || "默认";
        else if (type === "num") out.value = (Math.abs(v) < 10 ? (+v).toFixed(2) : v);
        else out.value = v;
      };
      el.addEventListener("input", function () {
        if (type === "bool") S[key] = el.checked;
        else if (type === "num") S[key] = parseFloat(el.value);
        else S[key] = el.value;
        if (b[0] === "setMaxTokens") S.maxTokens = parseInt(el.value, 10) || 0;
        fmt(); saveSettings();
        if (key === "theme") applyTheme();
        if (key === "ttsEngine") syncTtsBlocks();
        if (key === "ttsEnabled") syncMuteBtn();
        if (["modelScaleAdjust", "modelX", "modelY", "modelOpacity", "gaze", "idleMotion", "mouthScale"].indexOf(key) >= 0) applyLive();
        if (["ctxWindow", "keepRecent"].indexOf(key) >= 0) updateCtxInfo();
      });
      el.addEventListener("change", function () { el.dispatchEvent(new Event("input")); });
    });
  }

  function wireUI() {
    document.querySelectorAll(".tab").forEach(function (t) { t.onclick = function () { selectTab(t.dataset.tab); updateCtxInfo(); }; });
    document.querySelectorAll("[data-close]").forEach(function (c) { c.onclick = closeModal; });
    $("btnSettings").onclick = function () { openModal(); };
    $("btnMute").onclick = function () {
      S.ttsEnabled = !S.ttsEnabled; saveSettings();
      syncMuteBtn();
      $("setTtsEnabled").checked = S.ttsEnabled;
      if (!S.ttsEnabled) state.tts.stop();
      else state.tts.resume();
    };

    $("setPersona").addEventListener("input", function () {
      if (!S.personaByModel) S.personaByModel = {};
      S.personaByModel[DEF.id] = $("setPersona").value; saveSettings(); updateCtxInfo();
    });
    $("btnResetPersona").onclick = function () { S.personaByModel[DEF.id] = DEF.persona; $("setPersona").value = DEF.persona; saveSettings(); };
    $("setSummary").addEventListener("input", function () { memOf(DEF.id).summary = $("setSummary").value; saveMemories(); updateCtxInfo(); });
    $("btnCompact").onclick = async function () {
      const btn = $("btnCompact"); btn.textContent = "压缩中…";
      try { await AnAn.compact(new AnAn.LLM({ baseUrl: S.baseUrl, apiKey: S.apiKey, model: S.model }), S, memOf(DEF.id), sysPrompt()); } catch (e) {}
      btn.textContent = "立即压缩"; updateCtxInfo();
    };
    $("btnClearMem").onclick = function () { if (!confirm("清空「" + DEF.name + "」的对话记忆？")) return; AnAn.clearMemory(memOf(DEF.id)); saveMemories(); updateCtxInfo(); };
    $("btnTestApi").onclick = async function () {
      const el = $("apiTestResult"); el.className = "test-result"; el.textContent = "测试中…";
      try { const r = await new AnAn.LLM({ baseUrl: S.baseUrl, apiKey: S.apiKey, model: S.model }).test(); el.className = "test-result ok"; el.textContent = "✓ 成功：" + String(r.sample).slice(0, 36); }
      catch (e) { el.className = "test-result err"; el.textContent = "✗ " + (e.message || e); }
    };
    $("btnResetModel").onclick = function () {
      S.modelScaleAdjust = AnAn.DEFAULTS.modelScaleAdjust; S.modelX = 0; S.modelY = 0; S.modelOpacity = 1; S.gaze = true; S.idleMotion = true; S.mouthScale = 1;
      if (state.mmd) { state.mmd._yaw = 0; state.mmd._pitch = 0.08; state.mmd._dist = state.mmd._baseDist; }
      saveSettings(); fillSettings(); applyLive();
    };
    $("btnTestMotion").onclick = function () {
      if (!state.avatar) return;
      ["nod", "shake", "tilt", "bounce", "smile", "surprise", "shy", "think", "arm_wave", "stretch"].forEach(function (g, i) {
        setTimeout(function () { state.avatar.playGesture(g); }, i * 700);
      });
    };
    $("btnResetAll").onclick = function () {
      if (!confirm("恢复全部默认设置？（所有角色的记忆也会清空）")) return;
      S = Object.assign({}, AnAn.DEFAULTS); MEM = {}; DEF = AnAn.getModel(S.modelId);
      try { localStorage.removeItem(KEY); localStorage.removeItem(MEMKEY); } catch (e) {}
      saveSettings(); saveMemories(); applyTheme(); fillSettings(); applyLive(); updateBrand(); reloadModel(false);
    };

    $("btnCollapse").onclick = function () {
      const c = $("dock").classList.toggle("collapsed");
      S.inputCollapsed = c; saveSettings();
      setTimeout(layoutAll, 60);
      if (!c) $("chatInput").focus();
    };
  }

  function wireInput() {
    const input = $("chatInput");
    input.addEventListener("input", autosize);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    $("btnSend").onclick = send;
    input.addEventListener("focus", function () { setTimeout(function () { layoutAll(); }, 300); });
  }

  /* ── 启动 ── */
  async function boot() {
    applyTheme();
    setupViewport();
    updateBrand();
    renderModelCards(); fillSettings();
    wireBindings(); wireUI(); wireInput();
    armAudioUnlock();
    if (S.inputCollapsed) $("dock").classList.add("collapsed");

    showLoading();
    try { await reloadModel(false); }
    catch (e) { $("loading").innerHTML = '<div class="loader"><div class="loader-text">模型加载失败 😢<br><small>' + ((e && e.message) || e) + "</small></div></div>"; return; }
    setStatus("待机中");
    updateCtxInfo();

    setTimeout(function () {
      addBubble(DEF.greeting[(Math.random() * DEF.greeting.length) | 0], "reply");
      applyMood("calm");
      scheduleFeedHide();
    }, 500);

    window.__anan = state;
    window.__ananModelId = DEF.id;
    window.__ananKind = DEF.kind;
    window.__ananLoading = false;
    window.__ananPlay = function (n) { state.avatar && state.avatar.playGesture(n); };
    window.__ananSwitch = function (id) { return switchModel(id); };
    window.AnAn.__ready = true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { fillVoices(); };
    boot();
  });
})();
