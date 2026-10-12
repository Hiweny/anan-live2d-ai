/* ═══════════════════════════════════════════════════════════
   live2d.js — Live2D 控制器
   负责：加载模型、放置与自适应、视线/呼吸调参、表情切换、
   把参数读写能力暴露给动作引擎、点击命中判定。
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  const MODEL_URL = "assets/model/AnAn.model3.json";
  const TEXTURES = [
    "assets/model/textures/texture_00.png",
    "assets/model/textures/texture_01.png",
    "assets/model/textures/texture_02.png"
  ];

  /* 带进度的预载（把大贴图先灌进 HTTP 缓存，顺手统计进度） */
  function preload(urls, onProgress) {
    let total = 0, loaded = 0, done = 0;
    const sizes = new Array(urls.length).fill(0);
    return Promise.all(urls.map(function (u, i) {
      return fetch(u).then(function (r) {
        if (!r.body || !r.body.getReader) {
          return r.arrayBuffer().then(function (b) {
            sizes[i] = b.byteLength; loaded += b.byteLength; done++; emit(); return;
          });
        }
        sizes[i] = +(r.headers.get("content-length") || 0);
        total = sizes.reduce(function (a, b) { return a + b; }, 0);
        const reader = r.body.getReader();
        return (function read() {
          return reader.read().then(function (res) {
            if (res.done) { done++; emit(); return; }
            loaded += res.value.byteLength; emit();
            return read();
          });
        })();
      }).catch(function () { done++; emit(); });
    })).then(function () { return true; });

    function emit() {
      total = sizes.reduce(function (a, b) { return a + b; }, 0) || total;
      const p = total ? Math.min(0.99, loaded / total) : (done / urls.length) * 0.9;
      if (onProgress) onProgress(p);
    }
  }

  function Live2D(opts) {
    this.canvas = opts.canvas;
    this.onProgress = opts.onProgress || function () {};
    this.onHit = opts.onHit || function () {};
    this.app = null;
    this.model = null;
    this.engine = null;
    this._paramIndex = {};
    this._params = [];
    this._gaze = true;
    this._expr = "none";
  }

  Live2D.prototype.load = async function () {
    // 1) 预载贴图（进度）
    await preload(TEXTURES, this.onProgress);
    this.onProgress(0.99);

    // 2) PIXI 应用
    const app = new PIXI.Application({
      view: this.canvas,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      resizeTo: root,
      powerPreference: "high-performance"
    });
    this.app = app;
    app.stage.sortableChildren = true;

    // 3) 模型
    window.PIXI = PIXI;
    const model = await PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false });
    this.model = model;
    model.anchor.set(0.5, 1.0);
    model.sortableChildren = true;
    app.stage.addChild(model);

    const im = model.internalModel;
    this.coreModel = im.coreModel;

    // 4) 收集参数表（用于调试 / 展示）
    this._params = [];
    try {
      const cm = this.coreModel;
      let ids = null;
      try { if (cm._model && cm._model.parameters && cm._model.parameters.ids) ids = cm._model.parameters.ids; } catch (e) {}
      if (ids && ids.length) {
        for (let i = 0; i < ids.length; i++) this._params.push(String(ids[i]));
      } else if (typeof cm.getParameterId === "function") {
        const n = (typeof cm.getParameterCount === "function") ? cm.getParameterCount() : 0;
        for (let i = 0; i < n; i++) {
          let id = cm.getParameterId(i);
          if (id && typeof id.getString === "function") id = id.getString();
          this._params.push(String(id));
        }
      }
      AnAn.log("参数数量", this._params.length);
    } catch (e) {
      this.paramError = String((e && e.message) || e);
      AnAn.log("参数表收集失败", e);
    }

    // 5) 调温柔和的呼吸参数
    try {
      const B = PIXI.live2d.BreathParameterData || (im.breath && im.breath._parameters && null);
      if (im.breath && im.breath.setParameters) {
        const mk = (id, off, peak, cyc, w) => {
          if (PIXI.live2d.BreathParameterData) return new PIXI.live2d.BreathParameterData(id, off, peak, cyc, w);
          return { parameterId: id, offset: off, peak: peak, cycle: cyc, weight: w };
        };
        im.breath.setParameters([
          mk("ParamAngleX", 0, 6, 6.5345, 0.5),
          mk("ParamAngleY", 0, 4, 3.5345, 0.5),
          mk("ParamAngleZ", 0, 5, 5.5345, 0.5),
          mk("ParamBodyAngleX", 0, 3, 15.5345, 0.5),
          mk("ParamBreath", 0, 0.5, 3.2345, 0.5)
        ]);
      }
    } catch (e) { AnAn.log("呼吸调参失败", e); }

    // 6) 视线强度可调（覆盖 updateFocus）
    const self = this;
    im.updateFocus = function () {
      const strength = self._gaze ? 1 : 0;
      const m = this.coreModel;
      m.addParameterValueById("ParamEyeBallX", this.focusController.x);
      m.addParameterValueById("ParamEyeBallY", this.focusController.y);
      m.addParameterValueById("ParamAngleX", this.focusController.x * 22 * strength);
      m.addParameterValueById("ParamAngleY", this.focusController.y * 20 * strength);
      m.addParameterValueById("ParamAngleZ", this.focusController.x * this.focusController.y * -16 * strength);
      m.addParameterValueById("ParamBodyAngleX", this.focusController.x * 7 * strength);
    };

    // 7) 动作引擎挂到 beforeModelUpdate
    const host = {
      hasParam: function (id) {
        try { return self.coreModel.getParameterIndex(id) !== -1; } catch (e) { return false; }
      },
      range: function (id) {
        try {
          const i = self.coreModel.getParameterIndex(id);
          if (i < 0) return [0, 1];
          return [self.coreModel.getParameterMinimumValue(i), self.coreModel.getParameterMaximumValue(i)];
        } catch (e) { return [0, 1]; }
      },
      applyAdd: function (id, d) { try { self.coreModel.addParameterValueById(id, d, 1); } catch (e) {} },
      applySet: function (id, v, w) { try { self.coreModel.setParameterValueById(id, v, w == null ? 1 : w); } catch (e) {} }
    };
    this.engine = new AnAn.MotionEngine(host);
    im.on("beforeModelUpdate", function () { self.engine.apply(performance.now()); });

    // 8) 自适应
    this.layout();
    root.addEventListener("resize", function () { self.layout(); });

    // 9) 点击交互
    this._bindClick();
    return this;
  };

  Live2D.prototype.layout = function () {
    const m = this.model; if (!m) return;
    const W = this.app.renderer.width / this.app.renderer.resolution;
    const H = this.app.renderer.height / this.app.renderer.resolution;
    const oh = m.internalModel.originalHeight || 1;
    const s = this._userScale || 1;
    const base = (H * 0.76) / oh;
    m.scale.set(base * s);
    m.x = W * (0.5 + (this._userX || 0) * 0.32);
    m.y = H * (0.96 + (this._userY || 0) * 0.16);
  };

  Live2D.prototype.setTransform = function (opts) {
    if (opts.scale != null) this._userScale = opts.scale;
    if (opts.x != null) this._userX = opts.x;
    if (opts.y != null) this._userY = opts.y;
    if (opts.opacity != null && this.model) this.model.alpha = opts.opacity;
    this.layout();
  };
  Live2D.prototype.setGaze = function (on) { this._gaze = !!on; };

  /* 表情（内置 exp3 姿势切换） */
  Live2D.prototype.setExpression = function (name) {
    if (!this.model) return;
    if (name === this._expr) return;
    this._expr = name;
    try {
      if (!name || name === "none") {
        const mgr = this.model.internalModel.motionManager.expressionManager;
        if (mgr && mgr.resetExpression) mgr.resetExpression();
        else if (mgr && mgr.setExpression) mgr.setExpression(undefined);
      } else {
        this.model.expression(name);
      }
    } catch (e) { AnAn.log("表情设置失败", name, e); }
  };

  Live2D.prototype._bindClick = function () {
    const self = this;
    const cv = this.canvas;
    const handler = function (ev) {
      if (!self.model) return;
      const rect = cv.getBoundingClientRect();
      const px = (ev.clientX - rect.left);
      const py = (ev.clientY - rect.top);
      const b = self.model.getBounds();
      if (px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height) {
        const rel = (py - b.y) / b.height;
        // 粗略估计：靠上 40% 视作“头/脸”，其余视作“身体”
        const zone = rel < 0.42 ? "head" : "body";
        self.onHit(zone);
      } else {
        // 碰到空白区也允许轻微反馈
        self.onHit("empty");
      }
    };
    cv.addEventListener("pointerdown", handler);
  };

  /* 头部锚点（用于气泡定位），返回画布坐标 */
  Live2D.prototype.getHeadAnchor = function () {
    const m = this.model; if (!m) return { x: 0, y: 0 };
    const b = m.getBounds();
    // 头部约在可见包围盒上方 12% 处、水平略偏
    return {
      x: b.x + b.width * 0.5,
      y: b.y + 4
    };
  };

  Live2D.prototype.getParams = function () { return this._params.slice(); };

  AnAn.Live2D = Live2D;
})(window);
