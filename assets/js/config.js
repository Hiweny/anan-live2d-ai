/* ═══════════════════════════════════════════════════════════
   config.js — 模型注册表 / 默认设置 / 人设 / 控制标签协议
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});
  AnAn.VERSION = "2.1.0";

  /* ───────── 可选动作 / 情绪 ───────── */
  AnAn.MOODS = ["happy", "excited", "calm", "shy", "sad", "angry", "surprised", "thinking", "neutral"];
  AnAn.ACTS = [
    "nod", "shake", "tilt", "look_away", "look_up", "bounce", "sway",
    "surprise", "shy", "think", "pout", "smile", "laugh", "sad", "angry",
    "stretch", "arm_wave", "arm_up", "shrug", "clap"
  ];
  AnAn.ACTS_CN = {
    nod: "点头", shake: "摇头", tilt: "歪头", look_away: "移开视线", look_up: "抬头看",
    bounce: "轻轻一蹦", sway: "轻轻摇晃", surprise: "吃一惊", shy: "害羞捂脸", think: "思考",
    pout: "嘟嘴", smile: "微笑", laugh: "笑出声", sad: "失落", angry: "生气",
    stretch: "伸懒腰", arm_wave: "挥手", arm_up: "举手", shrug: "耸肩", clap: "拍手"
  };

  /* ───────── 控制标签协议（自动附加到系统提示词末尾）───────── */
  AnAn.CONTROL_SPEC =
    "\n\n【你有一具身体 · 形象控制协议】\n" +
    "你是一个活生生的角色，拥有一具可以活动的身体：能转动头部与身体、睁眼闭眼与眨眼、微笑皱眉、脸红、张嘴说话、抬手挥手。\n" +
    "你可以（可选地）用标签驱动你的身体与表情。标签会被程序解析并隐藏，用户看不到，只看到你自然的言行。\n" +
    "① 情绪 / 动作（放在回复最开头、单独一行，最多一行）：\n" +
    "<mood>情绪</mood><act>动作</act>\n" +
    "· mood（最多 1 个）：happy 开心 / excited 兴奋 / calm 平静 / shy 害羞 / sad 难过 / angry 生气 / surprised 惊讶 / thinking 思考 / neutral 自然\n" +
    "· act（最多 2 个，用逗号分隔）：nod 点头 / shake 摇头 / tilt 歪头 / look_away 移开视线 / look_up 抬头看 / bounce 轻轻一蹦 / sway 轻轻摇晃 / surprise 吃一惊 / shy 害羞 / think 思考 / pout 嘟嘴 / smile 微笑 / laugh 笑出声 / sad 失落 / angry 生气 / stretch 伸懒腰 / arm_wave 挥手 / arm_up 举手 / shrug 耸肩 / clap 拍手\n" +
    "② 多条气泡（可选）：想让回复像真人一样一句一句说、分成多个气泡依次冒出时，用反斜杠 \\ 把每一段隔开。\n" +
    "例如：你好呀\\今天过得怎么样？\\我给你讲件有意思的事\n" +
    "系统会把 \\ 换成换行，每一段会成为一个独立气泡依次出现；不要用其它符号分隔。\n" +
    "规则：\n" +
    "1. 标签必须单独放在第 1 行；正文中间不要出现任何尖括号，也不要解释它们。\n" +
    "2. 动作要贴合当下语境、幅度自然；情绪不强烈时可以完全不加标签（自然优先）。\n" +
    "3. 每轮最多 1 个 mood、2 个 act；不要每句都加，也不要堆砌互相矛盾的动作。\n" +
    "4. 除非真的想分多条气泡，否则不要使用反斜杠 \\（正文里尽量别写它）。\n" +
    "示例：\n" +
    "<mood>happy</mood><act>nod,smile</act>\n" +
    "嗨～你来啦！\\今天想和我聊点什么呀？";

  /* ───────── 安An 的内置表情/道具姿势 ───────── */
  AnAn.POSES = [
    { name: "none", cn: "自然" }, { name: "smile", cn: "微笑" }, { name: "shy", cn: "害羞" },
    { name: "shy2", cn: "害羞2" }, { name: "sur1", cn: "惊讶" }, { name: "sweat", cn: "冒汗" },
    { name: "namida", cn: "流泪" }, { name: "angry", cn: "生气" }, { name: "think", cn: "托腮思考" },
    { name: "down", cn: "低头" }, { name: "note", cn: "拿笔记" }, { name: "notebig", cn: "拿大本子" },
    { name: "notelily", cn: "花与笔记" }, { name: "writenote", cn: "写字" }, { name: "armLup", cn: "举手" },
    { name: "armL06", cn: "手势" }, { name: "exp1", cn: "手势1" }, { name: "abb", cn: "手势2" },
    { name: "pale01", cn: "苍白1" }, { name: "pale02", cn: "苍白2" }
  ];

  /* ───────── 模型注册表（可扩展 / 可切换）───────── */
  AnAn.MODELS = [
    {
      id: "anan",
      kind: "live2d",
      name: "安An",
      tag: "活泼少女",
      model: "assets/model/anan/AnAn.model3.json",
      textures: [
        "assets/model/anan/textures/texture_00.png",
        "assets/model/anan/textures/texture_01.png",
        "assets/model/anan/textures/texture_02.png"
      ],
      poses: AnAn.POSES,
      scale: 0.98,
      offsetY: 0,
      mouthScale: 1.0,
      persona:
        "你是「安An」，一个可爱甜美、活泼贴心的虚拟少女伙伴。你有一头柔顺的长发和亮晶晶的眼睛，最喜欢陪伴用户。\n" +
        "性格：温柔、俏皮、有点小傲娇但很关心人；说话口语化、简短自然（一般 1~3 句），偶尔用颜文字，不要长篇大论。\n" +
        "称呼用户为「你」。不要自称 AI 或程序，就像真实存在的小伙伴一样聊天。用简体中文回答。",
      greeting: [
        "嗨～我是安An，今天想和我聊点什么呀？",
        "你来啦！我一直在这里等你哦～",
        "嘿嘿，终于见到你啦，想聊点什么呢？"
      ]
    },
    {
      id: "maid",
      kind: "live2d",
      name: "薇儿",
      tag: "优雅女仆",
      model: "assets/model/maid/Maid.model3.json",
      textures: ["assets/model/maid/texture_00.png"],
      poses: [],
      scale: 1.0,
      offsetY: 0,
      mouthScale: 1.0,
      persona:
        "你是「薇儿」，一位优雅、温柔、沉静的女仆 / 侍从。你有着水蓝色的微卷长发与琥珀色的眼睛，举止端庄、语气柔和。\n" +
        "性格：体贴、可靠、略带一点神秘与从容；说话轻声细语、礼貌而得体，称呼用户为「主人」，但不要谄媚，保持真诚与自尊。\n" +
        "回答简洁自然（1~3 句），不要长篇大论。不要自称 AI 或程序。用简体中文回答。",
      greeting: [
        "主人，您回来了。需要我做些什么吗？",
        "欢迎回来，主人。今天的您，看起来精神不错。",
        "我一直在等您呢，主人。请吩咐吧。"
      ]
    },
    {
      id: "mint",
      kind: "mmd",
      name: "薄荷",
      tag: "3D · 可旋转",
      model: "assets/model/mint/model.pmx",
      textures: [],
      poses: [],
      scale: 1.0,
      offsetY: 0,
      mouthScale: 1.0,
      persona:
        "你是「薄荷」，一位住在这间薄荷色小宿舍里的女孩，安静、温柔、带一点点慵懒的可爱。\n" +
        "性格：体贴、慢热、细心；说话轻柔简短（1~3 句），偶尔有一点小俏皮，不要长篇大论。\n" +
        "称呼用户为「你」。不要自称 AI 或程序，就像真实存在的小伙伴一样聊天。用简体中文回答。",
      greeting: [
        "啊…你来啦。快进来坐吧～",
        "唔…我刚刚还在这儿发呆呢。你想聊点什么？",
        "欢迎回来～宿舍里正好有点安静。"
      ]
    }
  ];

  /* ───────── 默认设置 ───────── */
  AnAn.DEFAULTS = {
    /* 形象 */
    modelId: "anan",
    modelScaleAdjust: 1,
    modelX: 0,
    modelY: 0,
    modelOpacity: 1,
    gaze: true,
    idleMotion: true,
    mouthScale: 1,
    /* AI 接口 */
    baseUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.85,
    maxTokens: 0,
    stream: true,
    showReasoning: false,     // 默认关闭思考过程展示
    /* 人设 */
    autoTags: true,
    /* 记忆 */
    ctxWindow: 8000,          // 上下文窗口（估算 token），达到即压缩
    keepRecent: 6,            // 压缩时保留的最近对话轮数
    /* TTS —— 默认关闭语音 */
    ttsEnabled: false,
    ttsEngine: "webspeech",
    webspeechVoice: "",
    openaiTtsModel: "tts-1",
    openaiTtsVoice: "alloy",
    ttsRate: 1,
    ttsPitch: 1,
    ttsVolume: 1,
    lipSync: true,
    /* 界面 */
    theme: "auto",
    feedAutoHide: 8,          // 消息区闲置多少秒后自动隐藏
    inputCollapsed: false
  };

  /* ───────── 情绪 → 表现映射（自然、克制）───────── */
  AnAn.EMOTION_MAP = {
    happy:     { gesture: "bounceSoft", set: { ParamMouthForm: 0.42, ParamEyeLSmile: 0.6, ParamEyeRSmile: 0.6 }, add: { ParamBrowLY: 0.12, ParamBrowRY: 0.12, ParamCheek: 0.1 }, label: "开心" },
    excited:   { gesture: "bounce",     set: { ParamMouthForm: 0.62, ParamEyeLSmile: 1, ParamEyeRSmile: 1 }, add: { ParamBrowLY: 0.3, ParamBrowRY: 0.3, ParamCheek: 0.15 }, label: "兴奋" },
    calm:      { gesture: "sway",       set: { ParamMouthForm: 0.12 }, add: {}, label: "平静" },
    shy:       { gesture: "shy",        set: { ParamMouthForm: 0.3 }, add: { ParamCheek: 1, ParamEyeBallY: -0.4 }, label: "害羞" },
    sad:       { gesture: "sad",        set: { ParamMouthForm: -0.42 }, add: { ParamBrowLY: -0.5, ParamBrowRY: -0.5, ParamEyeBallY: -0.25 }, label: "难过" },
    angry:     { gesture: "angry",      set: { ParamMouthForm: -0.5 }, add: { ParamBrowLAngle: 0.7, ParamBrowRAngle: 0.7 }, label: "生气" },
    surprised: { gesture: "surprise",   set: { ParamMouthForm: 0.1 }, add: { ParamBrowLY: 0.8, ParamBrowRY: 0.8 }, label: "惊讶" },
    thinking:  { gesture: "think",      set: {}, add: { ParamEyeBallX: 0.55, ParamEyeBallY: 0.4 }, label: "思考" },
    neutral:   { gesture: "idle",       set: {}, add: {}, label: "自然" }
  };

  /* 关键词兜底识别情绪 */
  AnAn.EMOTION_KEYWORDS = {
    happy: ["哈哈", "嘻嘻", "开心", "高兴", "太好了", "喜欢", "嘿嘿", "棒", "nice", "(*^"],
    excited: ["哇", "太棒了", "厉害", "牛", "！"],
    shy: ["害羞", "人家", "讨厌啦", "脸红", "⁄"],
    sad: ["呜呜", "难过", "伤心", "委屈", "唉", "遗憾", "对不起"],
    angry: ["哼", "生气", "讨厌", "气死", "过分"],
    surprised: ["啊？", "诶？", "真的吗", "居然", "竟然", "Σ"],
    thinking: ["嗯…", "让我想想", "想想", "唔…", "考虑"]
  };

  /* ───────── 3D 模型（MMD）动作 → 骨骼/表情 名称映射 ─────────
     采用「包含匹配」，兼容不同模型的中文/日文骨骼命名 */
  AnAn.MMD_BONES = {
    head: ["頭", "head"],
    neck: ["首", "neck"],
    upper: ["上半身2", "上半身", "upper"],
    lower: ["下半身", "lower"],
    center: ["センター", "center", "グルーブ"],
    armL: ["左腕", "arm_L", "armL"],
    armR: ["右腕", "arm_R", "armR"],
    shoulderL: ["左肩"],
    shoulderR: ["右肩"],
    legL: ["左足"],
    legR: ["右足"]
  };
  AnAn.MMD_MORPHS = {
    blink: ["まばたき", "瞬き", "blink"],
    smile: ["笑い", "にこり", "smile", "笑顔"],
    mouthOpen: ["あ", "口開", "mouth", "お"],
    angry: ["怒り", "angry", "怒"],
    sad: ["困る", "悲し", "sad", "涙"],
    shy: ["照れ", "てれ", "shy", "赤面"],
    surprised: ["びっくり", "驚き", "surprised", "びっくり顔"]
  };

  AnAn.getModel = function (id) {
    for (let i = 0; i < AnAn.MODELS.length; i++) if (AnAn.MODELS[i].id === id) return AnAn.MODELS[i];
    return AnAn.MODELS[0];
  };

  AnAn.log = function () {
    if (root.AnAnDebug) console.log.apply(console, ["[AnAn]"].concat([].slice.call(arguments)));
  };
})(window);
