/* ═══════════════════════════════════════════════════════════
   live2d.js — Live2D 控制器（多模型）
   加载 / 切换模型、放置自适应、视线与呼吸调参、表情、
   参数桥（供动作引擎）、点击命中、头顶锚点。
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  function preload(urls, onProgress) {
    let total = 0, loaded = 0, done = 0;
    const sizes = new Array(urls.length).fill(0);
    const emit = function () {
      total = sizes.reduce(function (a, b) { return a + b; }, 0) || total;
      const p = total ? Math.min(0.99, loaded / total) : (done / urls.length) * 0.9;
      if (onProgress) onProgress(p);
    };
    return Promise.all(urls.map(function (u, i) {
      return fetch(u).then(function (r) {
        if (!r.body || !r.body.getReader) {
          return r.arrayBuffer().then(function (b) { sizes[i] = b.byteLength; loaded += b.byteLength; done++; emit(); });
        }
        sizes[i] = +(r.headers.get("content-length") || 0); total = sizes.reduce(function (a, b) { return a + b; }, 0);
        const reader = r.body.getReader();
        return (function read() {
          return reader.read().then(function (res) {
            if (res.done) { done++; emit(); return; }
            loaded += res.value.byteLength; emit(); return read();
          });
        })();
      }).catch(function () { done++; emit(); });
    })).then(function () { return true; });
  }

  function Live2D(opts) {
    this.canvas = opts.canvas;
    this.onProgress = opts.onProgress || function () {};
    this.onHit = opts.onHit || function () {};
    this.app = null;
    this.model = null;
    this.coreModel = null;
    this.engine = null;
    this.def = null;
    this._params = [];
    this.paramError = null;
    this._gaze = true;
    this._expr = "none";
    this._userScale = 1; this._userX = 0; this._userY = 0;
    this._loading = false;
  }

  Live2D.prototype._ensureApp = function () {
    if (this.app) return;
    const app = new PIXI.Application({
      view: this.canvas, backgroundAlpha: 0,
      antialias: true, autoDensity: true,
      resolution: Math.min(root.devicePixelRatio || 1, 2),
      resizeTo: root, powerPreference: "high-performance"
    });
    this.app = app;
    app.stage.sortableChildren = true;
    window.PIXI = PIXI;
    root.addEventListener("resize", function () { this.layout(); }.bind(this));
  };

  Live2D.prototype.load = async function (def) {
    if (this._loading) return;
    this._loading = true;
    this._ensureApp();
    if (this.def) { try { this.layoutScale(def); } catch (e) {} }

    // 预载贴图（进度）
    await preload(def.textures || [], this.onProgress);
    this.onProgress(0.99);

    // 卸载旧模型
    if (this.model) {
      try { this.app.stage.removeChild(this.model); } catch (e) {}
      try { this.model.destroy({ children: true, texture: false, baseTexture: false }); } catch (e) {}
      this.model = null; this.coreModel = null;
    }

    const model = await PIXI.live2d.Live2DModel.from(def.model, { autoInteract: false });
    this.model = model;
    this.def = def;
    model.anchor.set(0.5, 1.0);
    this.app.stage.addChild(model);

    const im = model.internalModel;
    this.coreModel = im.coreModel;

    // 参数表
    this._params = [];
    this.paramError = null;
    try {
      const cm = this.coreModel;
      let ids = null;
      try { if (cm._model && cm._model.parameters && cm._model.parameters.ids) ids = cm._model.parameters.ids; } catch (e) {}
      if (ids && ids.length) { for (let i = 0; i < ids.length; i++) this._params.push(String(ids[i])); }
      else if (typeof cm.getParameterId === "function") {
        const n = (typeof cm.getParameterCount === "function") ? cm.getParameterCount() : 0;
        for (let i = 0; i < n; i++) { let id = cm.getParameterId(i); if (id && id.getString) id = id.getString(); this._params.push(String(id)); }
      }
    } catch (e) { this.paramError = String((e && e.message) || e); }

    // 柔和呼吸
    try {
      if (im.breath && im.breath.setParameters) {
        const mk = function (id, off, peak, cyc, w) {
          if (PIXI.live2d.BreathParameterData) return new PIXI.live2d.BreathParameterData(id, off, peak, cyc, w);
          return { parameterId: id, offset: off, peak: peak, cycle: cyc, weight: w };
        };
        im.breath.setParameters([
          mk("ParamAngleX", 0, 6, 6.5345, 0.5), mk("ParamAngleY", 0, 4, 3.5345, 0.5),
          mk("ParamAngleZ", 0, 5, 5.5345, 0.5), mk("ParamBodyAngleX", 0, 3, 15.5345, 0.5),
          mk("ParamBreath", 0, 0.5, 3.2345, 0.5)
        ]);
      }
    } catch (e) {}

    // 视线强度可调
    const self = this;
    im.updateFocus = function () {
      const s = self._gaze ? 1 : 0;
      const m = this.coreModel;
      m.addParameterValueById("ParamEyeBallX", this.focusController.x);
      m.addParameterValueById("ParamEyeBallY", this.focusController.y);
      m.addParameterValueById("ParamAngleX", this.focusController.x * 20 * s);
      m.addParameterValueById("ParamAngleY", this.focusController.y * 18 * s);
      m.addParameterValueById("ParamAngleZ", this.focusController.x * this.focusController.y * -14 * s);
      m.addParameterValueById("ParamBodyAngleX", this.focusController.x * 6 * s);
    };

    // 参数桥
    const host = {
      hasParam: function (id) { try { return self.coreModel.getParameterIndex(id) !== -1; } catch (e) { return false; } },
      range: function (id) {
        try { const i = self.coreModel.getParameterIndex(id); if (i < 0) return [0, 1];
          return [self.coreModel.getParameterMinimumValue(i), self.coreModel.getParameterMaximumValue(i)]; }
        catch (e) { return [0, 1]; }
      },
      applyAdd: function (id, d) { try { self.coreModel.addParameterValueById(id, d, 1); } catch (e) {} },
      applySet: function (id, v, w) { try { self.coreModel.setParameterValueById(id, v, w == null ? 1 : w); } catch (e) {} }
    };
    if (!this.engine) this.engine = new AnAn.MotionEngine(host);
    else { this.engine.host = host; this.engine.stopAll(); }
    im.on("beforeModelUpdate", function () { self.engine.apply(performance.now()); });

    this._expr = "__init__";
    this.setExpression("none");
    this.layout();
    this.onProgress(1);
    this._loading = false;
    return this;
  };

  Live2D.prototype.setInsets = function (top, bottom) { this._insetTop = top; this._insetBottom = bottom; this.layout(); };

  Live2D.prototype.layout = function () {
    const m = this.model; if (!m || !this.app) return;
    const W = this.app.renderer.width / this.app.renderer.resolution;
    const H = this.app.renderer.height / this.app.renderer.resolution;
    const oh = m.internalModel.originalHeight || 1;
    const ow = m.internalModel.originalWidth || oh * 0.72;
    const top = this._insetTop || 0, bottom = this._insetBottom || 0;
    const availH = Math.max(150, H - top - bottom);
    const availW = W * 0.96;
    let s = availH / oh;
    if (ow * s > availW) s = availW / ow;              // 也按宽度适配，绝不横向溢出
    const def = this.def || { scale: 1 };
    m.scale.set(s * (def.scale || 1) * this._userScale);
    m.x = W * (0.5 + this._userX * 0.3);
    m.y = (H - bottom) + (def.offsetY || 0) * H + this._userY * H * 0.16;
    if (this._opacity != null) m.alpha = this._opacity;
  };

  Live2D.prototype.setTransform = function (o) {
    if (o.scale != null) this._userScale = o.scale;
    if (o.x != null) this._userX = o.x;
    if (o.y != null) this._userY = o.y;
    if (o.opacity != null) this._opacity = o.opacity;
    if (this.model && o.opacity != null) this.model.alpha = o.opacity;
    this.layout();
  };
  Live2D.prototype.setGaze = function (on) { this._gaze = !!on; };

  Live2D.prototype.setExpression = function (name) {
    if (!this.model) return;
    name = name || "none";
    if (name === this._expr) return;
    this._expr = name;
    try {
      const mgr = this.model.internalModel.motionManager.expressionManager;
      const defs = mgr && (mgr.definitions || mgr._definitions) || [];
      const has = defs.some(function (d) { return d.Name === name; });
      if (name === "none" || !has) { if (mgr && mgr.resetExpression) mgr.resetExpression(); }
      else this.model.expression(name);
    } catch (e) {}
  };

  Live2D.prototype.getHeadAnchor = function () {
    const m = this.model; if (!m) return { x: 0, y: 0 };
    const b = m.getBounds();
    return { x: b.x + b.width * 0.5, y: b.y + 4 };
  };
  Live2D.prototype.getParams = function () { return this._params.slice(); };

  AnAn.Live2D = Live2D;
})(window);
