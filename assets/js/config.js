/* ═══════════════════════════════════════════════════════════
   config.js — 默认设置 / 人设 / 情绪映射 / 控制标签协议
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  /* 默认人设（系统提示词） */
  AnAn.DEFAULT_PERSONA =
    "你是「安An」，一个可爱甜美、活泼贴心的虚拟少女伙伴。你有一头柔顺的头发和亮晶晶的眼睛，最喜欢陪伴用户。\n" +
    "性格：温柔、俏皮、有点小傲娇但很关心人；说话口语化、简短自然（一般 1~3 句），偶尔用颜文字，不要长篇大论。\n" +
    "称呼用户为「你」。不要自称AI或程序，就像真实存在的小伙伴一样聊天。用简体中文回答。";

  /* 自动附加的控制标签说明（让 AI 驱动形象） */
  AnAn.CONTROL_SPEC =
    "\n\n【形象控制协议】你可以在正式回复的最前面（可选）用下列标签控制你的表情动作，标签会被程序解析并隐藏，用户看不到。格式：\n" +
    "<mood>情绪</mood><act>动作</act><pose>道具</pose>\n" +
    "· mood 情绪（选一个）：happy 开心 / excited 兴奋 / calm 平静 / shy 害羞 / sad 难过 / angry 生气 / surprised 惊讶 / thinking 思考 / neutral 自然\n" +
    "· act 动作（可多个，逗号分隔）：nod 点头 / shake 摇头 / tilt 歪头 / look_away 转头 / bounce 蹦跳 / sway 摇摆 / surprise 一惊 / shy 捂脸害羞 / think 思考 / pout 嘟嘴 / smile 微笑 / laugh 大笑 / sad 低落 / angry 生气 / stretch 伸懒腰\n" +
    "· pose 道具姿势（可多个，可留空）：think 托腮 / note 拿笔记 / notebig 拿大本子 / writenote 写字 / armLup 举手 / shy 害羞 / sur1 惊一下 / sweat 冒汗 / namida 流泪 / pale01 苍白 / pale02 苍白2 / down 低头 / exp1 手势1 / abb 手势2 / angry 气鼓鼓 / notelily / armL06 / none 无\n" +
    "示例：<mood>happy</mood><act>nod,smile</act>嗨～你来啦！\n" +
    "不需要动作时可以完全不加标签，直接说话即可。不要在正文里解释这些标签。";

  /* 情绪 → 表现映射 */
  AnAn.EMOTION_MAP = {
    happy:     { gesture: "bounce",  expression: "none",   label: "开心",   mouth: 0.35, brow: 0.2 },
    excited:   { gesture: "bounce",  expression: "none",   label: "兴奋",   mouth: 0.5,  brow: 0.35 },
    calm:      { gesture: "sway",    expression: "none",   label: "平静",   mouth: 0.1 },
    shy:       { gesture: "shy",     expression: "shy",    label: "害羞",   mouth: 0.15, cheek: 0.85 },
    sad:       { gesture: "sad",     expression: "down",   label: "难过",   mouth: -0.4 },
    angry:     { gesture: "angry",   expression: "angry",  label: "生气",   mouth: -0.5 },
    surprised: { gesture: "surprise",expression: "sur1",   label: "惊讶",   mouth: 0.7 },
    thinking:  { gesture: "think",   expression: "think",  label: "思考",   pose: "think" },
    neutral:   { gesture: "idle",    expression: "none",   label: "自然" }
  };

  /* 设置项默认值 */
  AnAn.DEFAULTS = {
    /* AI 接口 */
    baseUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.8,
    maxTokens: 0,
    stream: true,
    showReasoning: true,
    /* 人设 */
    persona: "",
    autoTags: true,
    history: 10,
    /* TTS */
    ttsEnabled: true,
    ttsEngine: "edge",
    edgeVoice: "zh-CN-XiaoxiaoNeural",
    webspeechVoice: "",
    openaiTtsModel: "tts-1",
    openaiTtsVoice: "alloy",
    ttsRate: 1,
    ttsPitch: 1,
    ttsVolume: 1,
    lipSync: true,
    /* 形象 */
    modelScale: 1,
    modelX: 0,
    modelY: 0,
    modelOpacity: 1,
    gaze: true,
    idleMotion: true,
    mouthScale: 1,
    /* 界面 */
    theme: "auto",
    title: "安An",
    quickChips: true,
    clickReact: true,
    muted: false
  };

  /* 快捷提问 */
  AnAn.QUICK_CHIPS = ["你好呀～", "今天心情怎么样？", "讲个冷笑话", "夸夸我", "摸摸头", "陪我聊聊天"];

  /* 内置表情清单（name / 中文说明 / 用途提示） */
  AnAn.POSES = [
    { name: "none",      cn: "自然" },
    { name: "smile",     cn: "微笑" },
    { name: "shy",       cn: "害羞" },
    { name: "shy2",      cn: "害羞2" },
    { name: "sur1",      cn: "惊讶" },
    { name: "sweat",     cn: "冒汗" },
    { name: "namida",    cn: "流泪" },
    { name: "angry",     cn: "生气" },
    { name: "think",     cn: "托腮思考" },
    { name: "down",      cn: "低头" },
    { name: "note",      cn: "拿笔记" },
    { name: "notebig",   cn: "拿大本子" },
    { name: "notelily",  cn: "花与笔记" },
    { name: "writenote", cn: "写字" },
    { name: "armLup",    cn: "举手" },
    { name: "armL06",    cn: "手势" },
    { name: "exp1",      cn: "手势1" },
    { name: "abb",       cn: "手势2" },
    { name: "pale01",    cn: "苍白1" },
    { name: "pale02",    cn: "苍白2" }
  ];

  /* 微软 Edge TTS 精选中文/常用音色 */
  AnAn.EDGE_VOICES = [
    { id: "zh-CN-XiaoxiaoNeural", cn: "晓晓 · 温柔女声（推荐）" },
    { id: "zh-CN-XiaoyiNeural",   cn: "晓伊 · 活泼女声" },
    { id: "zh-CN-XiaobeiNeural",  cn: "晓北 · 可爱女声" },
    { id: "zh-CN-XiaohanNeural",  cn: "晓涵 · 知性女声" },
    { id: "zh-CN-XiaomengNeural", cn: "晓梦 · 甜美女声" },
    { id: "zh-CN-XiaoxuanNeural", cn: "晓萱 · 活泼女声" },
    { id: "zh-CN-XiaoyouNeural",  cn: "晓悠 · 少女童声" },
    { id: "zh-CN-liaoning-XiaobeiNeural", cn: "晓北 · 东北话" },
    { id: "zh-CN-shaanxi-XiaoniNeural",   cn: "晓妮 · 陕西话" },
    { id: "zh-TW-HsiaoChenNeural", cn: "曉臻 · 台湾女声" },
    { id: "zh-HK-HiuMaanNeural",   cn: "曉曼 · 粤语女声" },
    { id: "ja-JP-NanamiNeural",    cn: "Nanami · 日语女声" },
    { id: "en-US-AriaNeural",      cn: "Aria · 英文女声" },
    { id: "en-US-JennyNeural",     cn: "Jenny · 英文女声" }
  ];

  /* 情绪识别关键词（当模型没给标签时兜底） */
  AnAn.EMOTION_KEYWORDS = {
    happy:     ["哈哈", "嘻嘻", "开心", "高兴", "太好了", "喜欢", "嘿嘿", "棒", "nice", "(*^", "o(*"],
    excited:   ["哇", "太棒了", "！", "!!!", "厉害", "牛"],
    shy:       ["害羞", "人家", "讨厌啦", "⁄", "脸红"],
    sad:       ["呜呜", "难过", "伤心", "委屈", "哭", "唉", "遗憾"],
    angry:     ["哼", "生气", "讨厌", "气死", "过分"],
    surprised: ["啊？", "诶？", "真的吗", "居然", "竟然", "Σ"],
    thinking:  ["嗯…", "让我想想", "想想", "唔…", "考虑"]
  };

  AnAn.log = function () {
    if (root.AnAnDebug) console.log.apply(console, ["[AnAn]"].concat([].slice.call(arguments)));
  };
})(window);
