# 安An · 薇儿 · 薄荷 · AI 伙伴

> 由大模型驱动的智能伙伴 —— 会说话、会思考、会做表情、能动起来。纯前端，部署即用。

上半部分是她的**身体**（Live2D 或 3D 形象 + 头顶气泡），下半部分是**交流窗口**（消息区 + 输入框 + 设置）。
她由你提供的 **OpenAI 兼容大模型**驱动，用气泡回话、思考，并用全身的表情与动作回应你。

🔗 在线体验：`https://hiweny.github.io/anan-live2d-ai/`

---

## ✨ 主要特性

- **多模型 · 可切换**：内置「安An」（活泼少女 · Live2D）、「薇儿」（优雅女仆 · Live2D）与「薄荷」（3D · MMD）。切换模型会**同时切换对应的人设与记忆**（各自独立保存），新模型是**添加**而非替换。
- **Live2D + 3D 双形态**：Live2D 由自研动作引擎实时驱动头部 / 身体 / 眼睛 / 眉毛 / 嘴 / 脸颊 / **手臂**等参数；3D（MMD/PMX）用 three.js + MMDLoader 渲染，支持**拖动旋转、滚轮 / 双指缩放、闲置自动旋转**，并由骨骼 + 表情（morph）驱动动作。
- **灵动的消息系统**：
  - 头顶**多气泡**依次弹出（新消息把旧消息顶上去，带小尾巴与轻微浮动），永不超出屏幕；
  - 输入框上方有**消息区**：正常情况下只放「用户消息」（一行，新消息顶掉旧的）；当 AI 回复**太长或太多**时，自动把 AI 回复也搬进消息区，按真人节奏一条条冒出；
  - 消息区闲置一段时间会自动隐藏。
  - AI 还可以用反斜杠 `\` 主动把自己的回复分成多条气泡，依次冒出。
- **思考气泡**：等待时显示跳动的省略号（柔和光晕）；可选显示模型的推理过程。
- **记忆功能**：上下文窗口 + **滚动摘要自动压缩**。对话变长触发阈值后，较旧的对话会被压缩成一段「长期记忆摘要」，窗口重新计数，长期记忆不丢。
- **移动端友好**：响应式布局，绝不横向溢出；输入框会随软键盘升起（**覆盖**在模型之上，不会压缩模型本身）；可一键**收起 / 展开**输入框。
- **深色模式**：跟随系统，**无白闪**（在任何绘制之前就确定主题）。
- **语音（TTS）**：默认**关闭**；开启后使用**浏览器内置语音**（会自动挑中文神经音色，在 Edge / Windows 上即微软神经音色），也可选用 OpenAI 兼容 `/audio/speech`。右上角喇叭按钮可随时开 / 关。说话时**口型同步**。

## 🚀 使用

直接打开 `index.html`（建议用本地静态服务器，如 `python3 -m http.server`），或部署到 GitHub Pages。

首次配置：点击右上角 ⚙️ → **AI 接口**，填写 `Base URL / API Key / 模型名`，点「测试连接」。所有配置仅存于你浏览器的 localStorage，不会上传。

## 🎛 控制协议（AI 如何驱动身体）

开启「自动附加身体 / 动作说明」后，AI 会在回复**第 1 行**输出一行控制标签（会被隐藏）：

```
<mood>happy</mood><act>nod,smile</act>
嗨～你来啦！\今天想和我聊点什么呀？
```

- **mood**：happy / excited / calm / shy / sad / angry / surprised / thinking / neutral
- **act**：nod 点头 / shake 摇头 / tilt 歪头 / look_away / look_up / bounce / sway / surprise / shy / think / pout / smile / laugh / sad / angry / stretch 伸懒腰 / arm_wave 挥手 / arm_up 举手 / shrug 耸肩 / clap 拍手
- **多气泡**：用反斜杠 `\` 把回复分段，每段成为一个独立气泡；不用时就不会出现。

## 🤔 回答两个常见疑问

**为什么有的模型"能动得多"？**
**动到什么程度，取决于模型本身的绑定**（rig）——有哪些参数、范围多大、有没有手 / 腿 / 身体；**而"怎么动"由程序与 AI 决定**。本项目把模型当作"躯体"，用程序实时合成动作，所以同一套引擎换个模型就能适配（参数存在才驱动，不存在自动跳过）。AnAn 额外带有 18 个内置表情（道具 / 手势），所以看起来"花样"更多；薇儿没有内置表情，但支持同一套 22 个手势与全部情绪。

**网页端 AI 驱动只能做 Live2D 吗？不只是。**
- **3D / MMD** 同样可行：本项目已用 [three.js](https://threejs.org/) 的 `MMDLoader` 加载 `.pmx` 模型（也有 [babylon-mmd](https://github.com/noname0310/babylon-mmd) 这类方案，可直接加载 `.vmd` 动作含 IK / 物理）。
- 区别在于：Live2D 是"2D 参数化"，3D 是"骨骼 + 形态键"。3D 通常更适合播放预制动作 + 驱动表情 / 视线 / 口型；本项目为 3D 提供了骨骼驱动的程序化动作与 morph 表情。

## 🗂 目录结构

```
index.html
assets/
  css/style.css
  js/  config.js(模型注册表/设置/人设) memory.js(记忆压缩)
       motion.js(动作引擎) live2d.js(Live2D 控制) mmd3d.js(3D/MMD 控制)
       tts.js llm.js app.js
       lib/  pixi.js · pixi-live2d-display(cubism4) · live2dcubismcore
       lib/three/  three.module.min.js · loaders/MMDLoader.js · shaders · libs/mmdparser
  model/anan/  AnAn.moc3 · textures/ · expressions/ …
  model/maid/  Maid.moc3 · texture_00.png …
  model/mint/  model.pmx · textures/ …
  favicon.*
```

## 🔊 语音说明

1. **浏览器内置语音**（默认）：稳定可用；在 Edge / Windows 上用的就是微软神经音色（如"晓晓 Online"）。
2. **OpenAI 兼容 `/audio/speech`**：由你指定模型与音色。
3. 微软 Edge 在线 TTS 接口已被服务端收紧（返回 403），本项目不再内置。

## 📜 模型版权

- **安An**：为《魔法少女的魔女审判》二次创作同人模型，由 B 站 @万童Official / @断夏Official 联合出品，完全免费分享（<https://yamawamandou.booth.pm/>）。请勿用于商业用途。
- **薇儿 / 薄荷**：用户提供的模型资源，请遵循其原始授权（原作者已在资源内注明借物表 / 使用限制）。

请在你的使用场景中尊重原作者的授权条款。
