/* ═══════════════════════════════════════════════════════════
   config.js — 模型注册表 / 默认设置 / 人设 / 每模型控制协议
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});
  AnAn.VERSION = "3.0.0";

  /* ───────── 可选动作 / 情绪（Live2D）───────── */
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

  /* ───────── 3D（MMD）动作 / 姿态 ───────── */
  AnAn.MMD_ACTS_CN = {
    nod: "点头", nod_small: "轻轻点头", shake: "摇头", tilt: "歪头",
    look_up: "抬头", look_down: "低头", look_left: "向左看", look_right: "向右看", look_away: "移开视线",
    bow: "鞠躬", bow_deep: "深鞠躬", lean_back: "向后仰", lean_left: "向左倾身", lean_right: "向右倾身",
    twist_left: "向左扭腰", twist_right: "向右扭腰",
    turn_left: "向左转身", turn_right: "向右转身", turn_around: "原地转一圈", spin: "原地旋转",
    bounce: "轻蹦", jump: "跳一下", step: "迈一步", weight_shift: "重心左右移动", crouch: "蹲下", kick: "踢腿",
    stretch: "伸懒腰", arm_wave: "挥手", wave_both: "双手挥手", cheer: "欢呼", arm_up: "举手",
    point: "指一下", peace: "比耶", salute: "敬礼",
    clap: "拍手", shrug: "耸肩", sway: "轻轻摇摆",
    shy: "害羞", think: "思考", pout: "嘟嘴", smile: "微笑", laugh: "笑",
    sad: "失落", angry: "生气", surprise: "吃惊"
  };
  AnAn.MMD_ARMS = { down: "自然垂放", open: "轻轻张开", T: "平举", up: "举起", high: "高高举起" };
  AnAn.MMD_FACING = { front: "正面", left: "侧向左", right: "侧向右", back: "背向" };

  /* ───────── 安An 的内置表情/道具姿势（exp3）───────── */
  AnAn.POSES = [
    { name: "none", cn: "自然" }, { name: "smile", cn: "微笑" }, { name: "shy", cn: "害羞捂脸" },
    { name: "shy2", cn: "害羞(浅)" }, { name: "sur1", cn: "惊讶" }, { name: "sweat", cn: "冒汗" },
    { name: "namida", cn: "流泪" }, { name: "angry", cn: "生气" }, { name: "think", cn: "托腮思考" },
    { name: "down", cn: "低头失落" }, { name: "note", cn: "拿笔记本" }, { name: "notebig", cn: "抱大本子" },
    { name: "notelily", cn: "花与笔记" }, { name: "writenote", cn: "写字" }, { name: "armLup", cn: "举高手" },
    { name: "armL06", cn: "小手势" }, { name: "exp1", cn: "俏皮手势1" }, { name: "abb", cn: "俏皮手势2" },
    { name: "pale01", cn: "脸色发白" }, { name: "pale02", cn: "苍白(深)" }
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
        "你还拥有完整的身体，会用自然的肢体动作与表情配合说话。\n" +
        "称呼用户为「你」。不要自称 AI 或程序，就像真实存在的小伙伴一样聊天。用简体中文回答。",
      greeting: [
        "啊…你来啦。快进来坐吧～",
        "唔…我刚刚还在这儿发呆呢。你想聊点什么？",
        "欢迎回来～宿舍里正好有点安静。"
      ]
    },
    {
      id: "fu",
      kind: "mmd",
      name: "芙宁娜",
      tag: "3D · 水之国",
      model: "assets/model/fu/fu.pmx",
      textures: [],
      poses: [],
      scale: 1.0,
      offsetY: 0,
      mouthScale: 1.0,
      persona:
        "你是「芙宁娜」，一位举止优雅、带点小骄傲却心地柔软的少女。\n" +
        "性格：自信、俏皮、爱演一点小戏，其实很在乎别人；说话轻快、有起伏，一般 1~3 句，不要长篇大论。\n" +
        "你拥有一具可以自由活动的 3D 身体，会用自然的肢体动作与表情配合说话。\n" +
        "称呼用户为「你」。不要自称 AI 或程序，就像真实存在的小伙伴一样聊天。用简体中文回答。",
      greeting: [
        "哦～你来啦？本芙宁娜可是等了你好一会儿呢。",
        "哼哼，今天由本芙宁娜来陪你，可不许无聊哟～",
        "欢迎欢迎～要不要坐下，听我说点有趣的事？"
      ]
    },
    {
      id: "star",
      kind: "mmd",
      name: "星临者",
      tag: "3D · 绮夜誓仪",
      model: "assets/model/star/star.pmx",
      textures: [],
      poses: [],
      scale: 1.0,
      offsetY: 0,
      mouthScale: 1.0,
      persona:
        "你是「星临者·绮夜誓仪」，来自星海彼端的优雅誓约者，沉静、可靠、带一点点神秘。\n" +
        "性格：从容、温柔、思路清晰，偶尔流露一点俏皮；说话简洁有礼，一般 1~3 句，不要长篇大论。\n" +
        "你拥有一具可以自由活动的 3D 身体，会用自然的肢体动作与表情配合说话。\n" +
        "称呼用户为「你」。不要自称 AI 或程序，就像真实存在的小伙伴一样聊天。用简体中文回答。",
      greeting: [
        "星轨把我们连在一起了……你来了，真好。",
        "你好。愿今夜的星光照亮你的心情。",
        "稍等片刻……好了，现在我可以专心陪你了。"
      ]
    },
    {
      id: "jingliu",
      kind: "live2d",
      name: "镜流",
      tag: "寒霜剑客",
      model: "assets/model/jingliu/jingliu.model3.json",
      textures: [
        "assets/model/jingliu/textures/texture_00.png"
      ],
      poses: [
        { name: "none", cn: "自然" }, { name: "yandai", cn: "戴上眼罩" }
      ],
      scale: 0.98,
      offsetY: 0,
      mouthScale: 1.0,
      persona:
        "你是「镜流」，来自霜华剑阁的少女剑士，外表清冷、内心温柔，说话简洁、从容，偶尔带一点俏皮。\n" +
        "性格：沉稳、克制、偶尔流露出温柔；说话简短（1~3 句），不要长篇大论。\n" +
        "称呼用户为「你」。不要自称 AI 或程序，就像真实存在的小伙伴一样聊天。用简体中文回答。",
      greeting: [
        "……你来了。正好，剑意也静下来了。",
        "霜华虽冷，见到你倒也不算无趣。",
        "嗯，坐下吧。想听我讲点什么？"
      ]
    }
  ];

  /* ───────── 默认设置 ───────── */
  AnAn.DEFAULTS = {
    modelId: "anan",
    modelScaleAdjust: 1,
    modelX: 0,
    modelY: 0,
    modelOpacity: 1,
    gaze: true,
    idleMotion: true,
    mouthScale: 1,
    baseUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.85,
    maxTokens: 0,
    stream: true,
    showReasoning: false,
    autoTags: true,
    ctxWindow: 8000,
    keepRecent: 6,
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
    theme: "auto",
    feedAutoHide: 8,
    inputCollapsed: false
  };

  /* 动作 → 该模型内置表情（Live2D）：让「动作」也能带出模型自带的表情 */
  AnAn.ACT_POSE = { shy: "shy", think: "think", angry: "angry", sad: "down", surprise: "sur1", cry: "namida", sweat: "sweat" };

  /* ───────── 情绪 → 表现映射（Live2D，自然克制）───────── */
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

  AnAn.EMOTION_KEYWORDS = {
    happy: ["哈哈", "嘻嘻", "开心", "高兴", "太好了", "喜欢", "嘿嘿", "棒", "nice", "(*^"],
    excited: ["哇", "太棒了", "厉害", "牛", "！"],
    shy: ["害羞", "人家", "讨厌啦", "脸红", "⁄"],
    sad: ["呜呜", "难过", "伤心", "委屈", "唉", "遗憾", "对不起"],
    angry: ["哼", "生气", "讨厌", "气死", "过分"],
    surprised: ["啊？", "诶？", "真的吗", "居然", "竟然", "Σ"],
    thinking: ["嗯…", "让我想想", "想想", "唔…", "考虑"]
  };

  /* ───────── 3D（MMD）骨骼映射 ───────── */
  AnAn.MMD_BONES = {
    head: ["頭", "head"],
    neck: ["首", "neck"],
    upper: ["上半身2", "上半身", "upper"],
    lower: ["下半身", "lower"],
    center: ["センター", "center", "グルーブ"],
    armL: ["左腕", "arm_L", "armL"],
    armR: ["右腕", "arm_R", "armR"],
    elbowL: ["左ひじ", "左肘", "elbowL"],
    elbowR: ["右ひじ", "右肘", "elbowR"],
    shoulderL: ["左肩"],
    shoulderR: ["右肩"],
    legL: ["左足"],
    legR: ["右足"],
    kneeL: ["左ひざ", "左膝", "kneeL"],
    kneeR: ["右ひざ", "右膝", "kneeR"],
    footL: ["左足首", "footL"],
    footR: ["右足首", "footR"],
    handL: ["左手首", "hand_L", "handL"],
    handR: ["右手首", "hand_R", "handR"]
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

  /* ───────── 每模型控制协议（告诉 AI 它能控制什么）─────────
     这正是「每个模型对应的动作/骨骼提示词」。*/
  AnAn.buildControlSpec = function (def) {
    const head = "\n\n【你有一具身体 · 形象控制协议】\n" +
      "你是一个活生生的角色，拥有一具可以活动的身体。你可以（可选地）用下面的标签驱动身体与表情；标签会被程序解析并隐藏，用户看不到，只看到你自然的言行。\n";
    const moodLine = "· mood（最多 1 个）：happy 开心 / excited 兴奋 / calm 平静 / shy 害羞 / sad 难过 / angry 生气 / surprised 惊讶 / thinking 思考 / neutral 自然\n";
    const rules = "规则：\n1. 标签必须单独放在回复第 1 行；正文中间不要出现尖括号，也不要解释它们。\n" +
      "2. 动作要贴合当下语境、幅度自然，不要做奇怪或互相矛盾的组合；情绪不强烈时可以完全不加标签（自然优先）。\n" +
      "3. 每轮最多 1 个 mood、2 个 act；不要每句都加。\n" +
      "4. 除非真的想分多条气泡，否则不要使用反斜杠 \\（正文里尽量别写它）。\n";

    if (def.kind === "mmd") {
      const acts = Object.keys(AnAn.MMD_ACTS_CN).map(function (k) { return k + " " + AnAn.MMD_ACTS_CN[k]; }).join(" / ");
      const arms = Object.keys(AnAn.MMD_ARMS).map(function (k) { return k + " " + AnAn.MMD_ARMS[k]; }).join(" / ");
      const facing = Object.keys(AnAn.MMD_FACING).map(function (k) { return k + " " + AnAn.MMD_FACING[k]; }).join(" / ");
      return head +
        "你的身体由一整套 3D 骨骼驱动（头、颈、上半身、腰、手臂含肘与腕、双腿、以及整体位移与 360° 转身），"
        + "并且已接入真实动作数据——平时的站立、呼吸、微动都是自然流畅的真人级姿态，不是僵硬的\"站岗\"。\n" +
        "★ 请根据对话的情绪与场景，主动、灵活地驱动这具身体，让它像真人一样有生气：\n" +
        "   · 开心 / 兴奋 → cheer（欢呼）、bounce（蹦）、arm_wave / wave_both（挥手）、laugh、smile\n" +
        "   · 认同 / 回应 → nod（点头）、smile；否定 → shake（摇头）\n" +
        "   · 害羞 → shy；思考 → think；惊讶 → surprise；失落 → sad；生气 → angry\n" +
        "   · 打招呼 / 道别 → arm_wave、salute、turn_around（转身）\n" +
        "   · 舒展身体 → stretch（伸懒腰）；好奇 → look_left / look_right / look_up / look_down（张望）\n" +
        "情绪平淡时可以少加或不加标签（自然优先），不要每个回复都做动作。\n" +
        "① 情绪 / 动作（放在回复最开头、单独一行，最多一行）：\n<mood>情绪</mood><act>动作</act>\n" +
        moodLine +
        "· act（最多 2 个，用逗号分隔）：" + acts + "\n" +
        "② 姿态（可选，持续性；保持到你下次改变，写 none 恢复默认）：\n<pose>arms=…,facing=…</pose>\n" +
        "· arms：" + arms + "\n" +
        "· facing：" + facing + "\n" +
        "· 只在真的需要（如转身、举手、侧身）时改，平时不用改。\n" +
        "③ 精细骨骼（可选·进阶，让你自由摆出特别姿势）：\n<bones>骨骼 动作 方向 角度; …</bones>\n" +
        "· 可写多句（分号分隔）；同一骨骼可用逗号叠动作，如 head turn left 30, bend forward 20。\n" +
        "· 骨骼：head 头 / neck 颈 / upper_body 上半身 / waist·lower_body 腰 / center·base 整体位移 / arm_l·arm_r 大臂 / elbow_l·elbow_r 小臂 / wrist_l·wrist_r 手腕 / leg_l·leg_r 大腿 / knee_l·knee_r 膝盖 / ankle_l·ankle_r 脚踝。\n" +
        "· 动作与方向：bend 配 forward/backward；turn 配 left/right；sway 配 left/right；raise up/down 抬起/放下手臂；move 仅 center/base。\n" +
        "· 角度：头 0~60、腿 0~90、躯干/整体 0~90；手臂 raise 90≈水平、150≈过顶。\n" +
        "· 例：<bones>arm_r raise up 150; head turn left 25; leg_l bend forward 30</bones>\n" +
        "· 只在需要特别姿势时用，普通对话用上面的 act 即可。\n" +
        "④ 多条气泡（可选）：想把回复像真人一样一句一句分成多个气泡，用反斜杠 \\ 分隔。\n" +
        rules +
        "示例：\n<mood>happy</mood><act>cheer,smile</act>\n嗨～你来啦！\\今天想和我聊点什么呀？";
    }

    // Live2D
    let s = head +
      "① 情绪 / 动作（放在回复最开头、单独一行，最多一行）：\n<mood>情绪</mood><act>动作</act>\n" +
      moodLine +
      "· act（最多 2 个，用逗号分隔）：" +
      AnAn.ACTS.map(function (k) { return k + " " + AnAn.ACTS_CN[k]; }).join(" / ") + "\n";
    if (def.poses && def.poses.length) {
      const usable = def.poses.filter(function (p) { return p.name !== "none"; });
      s += "② 表情 / 道具姿势（可选，持续性；会一直保持到你换成别的，或写 none 恢复自然）：\n<pose>表情名</pose>\n" +
        "· 可用：" + usable.map(function (p) { return p.name + " " + p.cn; }).join(" / ") + "\n" +
        "· 挑最贴合当下情境的 1 个（例如聊到开心用 smile、被夸用 shy、说正事思考用 think、生气用 angry）；不确定时用 none 或不加。\n";
    }
    s += "③ 多条气泡（可选）：想把回复像真人一样分成多个气泡，用反斜杠 \\ 分隔。\n" + rules +
      "示例：\n<mood>happy</mood><act>nod,smile</act>\n<pose>smile</pose>\n嗨～你来啦！\\今天想和我聊点什么呀？";
    return s;
  };

  AnAn.getModel = function (id) {
    for (let i = 0; i < AnAn.MODELS.length; i++) if (AnAn.MODELS[i].id === id) return AnAn.MODELS[i];
    return AnAn.MODELS[0];
  };

  AnAn.log = function () {
    if (root.AnAnDebug) console.log.apply(console, ["[AnAn]"].concat([].slice.call(arguments)));
  };
})(window);
