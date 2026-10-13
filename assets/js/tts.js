/* ═══════════════════════════════════════════════════════════
   tts.js — 语音合成
   1) 浏览器内置语音（Web Speech API，稳定，离线可用）
   2) OpenAI 兼容 /audio/speech
   （微软 Edge TTS 在线接口已被服务端限制，不再内置）
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  /* ── TTS 管理器 ── */
  function TTS() {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this._ctx = null; this._analyser = null; this._srcNode = null; this._freq = null;
    this.playing = false;
    this._blobUrl = null;
    this.lastEngine = "";
    this.lastVoice = "";
    this.lastError = null;
  }

  TTS.prototype._ensureContext = function () {
    if (this._ctx) { if (this._ctx.state === "suspended") this._ctx.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    try {
      this._ctx = new AC();
      this._srcNode = this._ctx.createMediaElementSource(this.audio);
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 512;
      this._srcNode.connect(this._analyser);
      this._analyser.connect(this._ctx.destination);
      this._freq = new Uint8Array(this._analyser.fftSize);
    } catch (e) { AnAn.log("AudioContext 初始化失败", e); this._analyser = null; }
  };
  TTS.prototype.resume = function () { this._ensureContext(); if (this._ctx && this._ctx.state === "suspended") this._ctx.resume(); };

  TTS.prototype.level = function () {
    if (!this._analyser) return 0;
    this._analyser.getByteTimeDomainData(this._freq);
    let sum = 0;
    for (let i = 0; i < this._freq.length; i++) { const v = (this._freq[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / this._freq.length);
    return Math.min(1, rms * 3.4);
  };

  TTS.prototype._playBlob = function (blob, cfg) {
    const self = this;
    return new Promise(function (resolve) {
      self.stop();
      self._ensureContext();
      if (self._blobUrl) URL.revokeObjectURL(self._blobUrl);
      self._blobUrl = URL.createObjectURL(blob);
      self.audio.src = self._blobUrl;
      self.audio.volume = cfg.volume == null ? 1 : cfg.volume;
      self.playing = true;
      const done = function () { self.playing = false; resolve(); };
      self.audio.onended = done;
      self.audio.onerror = done;
      const p = self.audio.play();
      if (p && p.catch) p.catch(function (e) { AnAn.log("播放失败", e); done(); });
    });
  };

  /* 自动挑选系统里最好的中文神经音色 */
  TTS.prototype._pickVoice = function (wantName) {
    if (!root.speechSynthesis) return null;
    var vs = speechSynthesis.getVoices() || [];
    if (wantName) { var hit = vs.filter(function (x) { return x.name === wantName; })[0]; if (hit) return hit; }
    var zh = vs.filter(function (x) { return /zh|Chinese|\u4e2d\u6587/i.test(x.lang + " " + x.name); });
    return zh.filter(function (x) { return /Online \(Natural\)/i.test(x.name); })[0]
      || zh.filter(function (x) { return /Xiaoxiao|Xiaoyi|Xiaobei|Xiaomo|Xiaohan|Xiaoxuan|Huihui|Yaoyao|Kangkang/i.test(x.name); })[0]
      || zh[0] || null;
  };

  TTS.prototype._speakWeb = function (text, cfg) {
    const self = this;
    return new Promise(function (resolve) {
      if (!root.speechSynthesis) return resolve();
      self.stop();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = cfg.lang || "zh-CN";
      u.rate = cfg.rate || 1;
      u.pitch = cfg.pitch || 1;
      u.volume = cfg.volume == null ? 1 : cfg.volume;
      const v = self._pickVoice(cfg.voiceName);
      if (v) { u.voice = v; if (v.lang) u.lang = v.lang; }
      self.lastVoice = v ? v.name : "(default)";
      let ended = false;
      self.playing = true;
      const finish = function () { if (ended) return; ended = true; self.playing = false; resolve(); };
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      // 兜底：某些浏览器不触发 onend
      const est = Math.min(60000, 1200 + text.length * 260);
      setTimeout(finish, est);
    });
  };

  TTS.prototype._speakOpenAI = async function (text, cfg) {
    const base = (cfg.baseUrl || "").replace(/\/+$/, "");
    if (!base) throw new Error("未配置 Base URL");
    const res = await fetch(base + "/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (cfg.apiKey || "") },
      body: JSON.stringify({
        model: cfg.model || "tts-1",
        input: text,
        voice: cfg.voice || "alloy",
        response_format: "mp3"
      })
    });
    if (!res.ok) throw new Error("TTS HTTP " + res.status);
    const blob = await res.blob();
    return this._playBlob(blob, cfg);
  };

  /* 对外：合成并播放一句话；返回 {engine} */
  TTS.prototype.speak = async function (text, cfg) {
    if (!text || !text.trim()) return { engine: "none" };
    cfg = cfg || {};
    const engine = cfg.engine || "webspeech";
    if (engine === "openai") {
      try {
        this.lastEngine = "openai";
        await this._speakOpenAI(text, cfg);
        return { engine: "openai" };
      } catch (e) {
        AnAn.log("OpenAI TTS 失败，回退浏览器语音", e);
        this.lastError = String((e && e.message) || e);
        cfg.onFallback && cfg.onFallback("OpenAI TTS 失败，已改用浏览器语音");
      }
    }
    this.lastEngine = "webspeech";
    await this._speakWeb(text, cfg);
    return { engine: "webspeech" };
  };

  TTS.prototype.stop = function () {
    try { this.audio.pause(); } catch (e) {}
    try { if (root.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    this.playing = false;
  };

  TTS.prototype.webVoices = function () {
    if (!root.speechSynthesis) return [];
    return speechSynthesis.getVoices().filter(function (v) { return /^zh|Chinese|中文/i.test(v.lang + v.name); });
  };

  AnAn.TTS = TTS;
})(window);
