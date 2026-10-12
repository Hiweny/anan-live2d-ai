# 安An · AI Live2D 伙伴

> 一个由大模型驱动的 Live2D 智能伙伴——会说话、会思考、会做表情。纯前端，部署即用。

上半部分是她的**身体**（Live2D 形象 + 头顶气泡），下半部分是**交流窗口**（输入框 + 设置）。
她由你提供的 **OpenAI 兼容大模型**驱动，用气泡回话、思考，并用全身的表情与动作回应你。

🔗 在线体验：`https://hiweny.github.io/anan-live2d-ai/`

---

## ✨ 特性

- **完整 Live2D 形象**：Cubism 4 模型，4096→2048 高清贴图，自适应布局，逐帧渲染。
- **AI 驱动身体**：自研动作引擎，实时驱动 **30+ 个模型参数**（头部/身体/眼睛/眉毛/嘴/腮红/呼吸）+ **18 个内置表情/道具姿势**，让模型成为 AI 的躯体。
- **情绪 → 表现映射**：AI 用轻量标签（`<mood>` / `<act>` / `<pose>`）驱动，标签自动隐藏；未给标签时用关键词兜底识别。
- **头顶气泡**：回复气泡 + 思考气泡（支持流式显示模型的 `reasoning` 推理过程）。
- **语音合成（TTS）**：微软 Edge TTS（免费，无需密钥）为主，自动回退「浏览器内置语音」；也支持 OpenAI 兼容 `/audio/speech`。
- **口型同步**：说话时用 Web Audio 分析音量驱动嘴部参数，无需模型额外配置。
- **可视设置**：人设提示词、AI 接口、语音、形象（缩放/位置/透明度）、主题，全部可视化调节并本地保存。
- **优雅界面**：玻璃拟态 + 柔和渐变背景 + 明暗主题，桌面/移动端自适应。

## 🚀 使用

### 方式一：直接用
打开 `index.html` 即可（建议用本地静态服务器，例如 `python3 -m http.server`）。

### 方式二：部署到 GitHub Pages
1. 把仓库设为公开，进入 **Settings → Pages**，Source 选 `main` 分支根目录。
2. 访问 `https://<你的用户名>.github.io/<仓库名>/`。

### 首次配置
点击右上角 ⚙️ 打开设置：
1. **AI 接口**：填写 `Base URL`（如 `https://api.openai.com/v1`）、`API Key`、`模型名称`，点「测试连接」。
2. **人设**：编辑系统提示词，设定她的性格与说话方式（默认是可爱甜美的少女）。
3. **语音**：选择引擎与音色（默认晓晓），可关闭。

> 所有配置只保存在你浏览器的 localStorage 里，不会上传，也不写入仓库。

## 🔊 语音（TTS）说明

语音按「可用性」自动降级，体验优先：

1. **微软 Edge TTS（免费）**：无需密钥，直接连微软在线朗读接口。但该接口近期已收紧（非 Edge 浏览器/机房网络常返回 403），可用时音质最佳，不可用时会**自动**切换到下一种。
2. **浏览器内置语音（Web Speech API）**：离线可用、稳定，会自动挑选系统里最好的中文神经音色（如「Microsoft 晓晓 Online (Natural)」）。多数情况下实际听到的是它。
3. **OpenAI 兼容 `/audio/speech`**：填好「AI 接口」后可选，音色由你指定。

> 一句话：默认会先尝试微软免费接口，连不上就自动用系统语音，全程无需你操心。

## 🎛 控制标签协议

开启「自动附加控制标签」后，AI 会在回复开头用如下标签驱动形象（标签会被程序解析并隐藏）：

```
<mood>happy</mood><act>nod,smile</act><pose>shy</pose>嗨～你来啦！
```

- **mood**：happy / excited / calm / shy / sad / angry / surprised / thinking / neutral
- **act**：nod 点头 / shake 摇头 / tilt 歪头 / look_away 转头 / bounce 蹦跳 / sway 摇摆 / surprise 一惊 / shy 捂脸 / think 思考 / pout 嘟嘴 / smile 微笑 / laugh 大笑 / sad 低落 / angry 生气 / stretch 伸懒腰
- **pose**：内置表情/道具姿势（think 托腮 / note 拿笔记 / shy 害羞 / sur1 惊讶 / sweat 冒汗 / namida 流泪 / armLup 举手 / … / none 无）

兼容写法：`[emotion:happy]`、`[act:nod]`、`#EMOTION#happy`。全部可选。

## 🗂 目录结构

```
index.html
assets/
  css/style.css
  js/
    lib/                # pixi.js / pixi-live2d-display / live2dcubismcore
    config.js           # 默认设置、人设、情绪映射
    motion.js           # 动作引擎（参数驱动 + 手势库 + 口型）
    live2d.js           # 模型加载与控制
    tts.js              # 语音合成（Edge / 浏览器 / OpenAI）
    llm.js              # OpenAI 兼容客户端 + 标签解析
    app.js              # 界面与业务逻辑
  model/                # Live2D 模型与表情
    AnAn.model3.json AnAn.moc3 AnAn.physics3.json
    textures/ expressions/
  favicon.*
```

## 🧩 技术栈

- [PixiJS](https://pixijs.com/) + [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display)（Cubism 4）渲染
- 原生 JS，无构建步骤，纯静态托管
- 参考了 [Amatsutsumi/live2d-ai-web](https://github.com/Amatsutsumi/live2d-ai-web) 等社区项目的思路

## 📜 模型版权

本模型为《魔法少女的魔女审判》**二次创作同人模型**，由 B 站 **@万童Official**、**@断夏Official** 联合出品，完全免费分享。
原始发布：<https://yamawamandou.booth.pm/>。请勿用于商业/付费用途。感谢原作者！

> 若你替换为自己的模型，请务必确认相应的授权与版权。
