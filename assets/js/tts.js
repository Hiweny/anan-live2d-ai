/* ═══════════════════════════════════════════════════════════
   tts.js — 语音合成
   1) 微软 Edge TTS（免费在线，WebSocket，自动计算 Sec-MS-GEC 令牌）
   2) 浏览器内置语音（Web Speech API）
   3) OpenAI 兼容 /audio/speech
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});
  const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
    return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  }
  async function secMsGec() {
    let ticks = BigInt(Math.floor(Date.now() / 1000)) + 11644473600n;
    ticks = ticks * 10000000n;
    ticks = ticks - (ticks % 3000000000n);
    const str = ticks.toString() + TOKEN;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function rateStr(r) { const p = Math.round((r - 1) * 100); return (p >= 0 ? "+" : "") + p + "%"; }
  function pitchStr(p) { const hz = Math.round((p - 1) * 50); return (hz >= 0 ? "+" : "") + hz + "Hz"; }

  /* ── Edge TTS ── */
  async function edgeSynth(text, o) {
    const voice = o.voice || "zh-CN-XiaoxiaoNeural";
    const gec = await secMsGec();
    const cid = uuid();
    const url =
      "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1" +
      "?TrustedClientToken=" + TOKEN +
      "&Sec-MS-GEC=" + gec +
      "&Sec-MS-GEC-Version=1-130.0.2849.68" +
      "&ConnectionId=" + cid;

    return new Promise(function (resolve, reject) {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { return reject(e); }
      ws.binaryType = "arraybuffer";
      const chunks = [];
      let finished = false;
      const timer = setTimeout(function () { cleanup(); reject(new Error("Edge TTS 超时")); }, 20000);
      function cleanup() { try { ws && ws.close(); } catch (e) {} }
      function finish() {
        if (finished) return; finished = true; clearTimeout(timer); cleanup();
        if (!chunks.length) return reject(new Error("Edge TTS 无音频返回"));
        resolve(new Blob(chunks, { type: "audio/mpeg" }));
      }
      ws.onopen = function () {
        try {
          ws.send("X-Timestamp:" + new Date().toISOString() + "\r\n" +
            "Content-Type:application/json; charset=utf-8\r\n" +
            "Path:speech.config\r\n\r\n" +
            JSON.stringify({ context: { synthesis: { audio: {
              metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3" } } } }));
          const ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">' +
            '<voice name="' + voice + '"><prosody pitch="' + pitchStr(o.pitch || 1) +
            '" rate="' + rateStr(o.rate || 1) + '" volume="+0%">' + esc(text) + '</prosody></voice></speak>';
          ws.send("X-RequestId:" + uuid() + "\r\n" +
            "Content-Type:application/ssml+xml\r\n" +
            "X-Timestamp:" + new Date().toISOString() + "\r\n" +
            "Path:ssml\r\n\r\n" + ssml);
        } catch (e) { clearTimeout(timer); cleanup(); reject(e); }
      };
      ws.onmessage = function (ev) {
        if (typeof ev.data === "string") {
          if (ev.data.indexOf("Path:turn.end") !== -1) finish();
          return;
        }
        try {
          const buf = new Uint8Array(ev.data);
          const hlen = (buf[0] << 8) | buf[1];
          const header = new TextDecoder().decode(buf.slice(2, 2 + hlen));
          if (header.indexOf("Path:audio") !== -1) chunks.push(buf.slice(2 + hlen));
        } catch (e) {}
      };
      ws.onerror = function () { clearTimeout(timer); if (!finished) { finished = true; cleanup(); reject(new Error("Edge TTS 连接失败")); } };
      ws.onclose = function (e) {
        if (finished) return;
        if (chunks.length) finish();
        else { finished = true; clearTimeout(timer); reject(new Error("Edge TTS 已关闭 " + (e && e.code))); }
      };
    });
  }

  /* ── TTS 管理器 ── */
  function TTS() {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this._ctx = null; this._analyser = null; this._srcNode = null; this._freq = null;
    this.playing = false;
    this._blobUrl = null;
    this.lastEngine = "";
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
      if (cfg.voiceName) {
        const v = speechSynthesis.getVoices().filter(function (x) { return x.name === cfg.voiceName; })[0];
        if (v) u.voice = v;
      }
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
    const engine = cfg.engine || "edge";
    if (engine === "webspeech") {
      this.lastEngine = "webspeech";
      await this._speakWeb(text, cfg);
      return { engine: "webspeech" };
    }
    if (engine === "openai") {
      try {
        this.lastEngine = "openai";
        await this._speakOpenAI(text, cfg);
        return { engine: "openai" };
      } catch (e) {
        AnAn.log("OpenAI TTS 失败，回退浏览器语音", e);
        cfg.onFallback && cfg.onFallback("OpenAI TTS 失败，已改用浏览器语音");
        this.lastEngine = "webspeech";
        await this._speakWeb(text, cfg);
        return { engine: "webspeech" };
      }
    }
    // edge（默认）
    try {
      const blob = await edgeSynth(text, {
        voice: cfg.edgeVoice || "zh-CN-XiaoxiaoNeural",
        rate: cfg.rate || 1, pitch: cfg.pitch || 1
      });
      this.lastEngine = "edge";
      await this._playBlob(blob, cfg);
      return { engine: "edge" };
    } catch (e) {
      AnAn.log("Edge TTS 失败，回退浏览器语音", e);
      cfg.onFallback && cfg.onFallback("Edge TTS 不可用，已改用浏览器语音");
      this.lastEngine = "webspeech";
      await this._speakWeb(text, cfg);
      return { engine: "webspeech" };
    }
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
  AnAn.edgeSynth = edgeSynth;
})(window);
