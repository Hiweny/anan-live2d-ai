# 安An · 镜流 · 薄荷 · 芙宁娜 · 星临者 · AI 伙伴

> 由大模型驱动的智能伙伴 —— 会说话、会思考、会做表情、能动起来。纯前端，部署即用。

上半部分是她的**身体**（Live2D 或 3D 形象 + 头顶气泡），下半部分是**交流窗口**（消息区 + 输入框 + 设置）。
她由你提供的 **OpenAI 兼容大模型**驱动，用气泡回话、思考，并用全身的表情与动作回应你。

🔗 在线体验：`https://hiweny.github.io/anan-live2d-ai/`

---

## ✨ 主要特性

- **多模型 · 可切换**：内置「安An」（活泼少女 · Live2D）、「镜流」（寒霜剑客 · Live2D）、「薄荷」「芙宁娜」「星临者」（3D · MMD/PMX）。切换模型会**同时切换对应的人设与记忆**（各自独立保存），新模型是**添加**而非替换。
- **AI 驱动身体（可用什么就告诉 AI 什么）**：系统提示词会**按当前模型**生成一份「控制协议」，把该模型能做的动作 / 骨骼 / 表情**逐条列给 AI**，由 AI 决定怎么用：
  - **Live2D（安An）**：mood 情绪 + act 动作 + **pose 内置表情 / 道具姿势**（微笑、害羞、托腮思考、拿笔记、举高手……共 19 个内置 exp3）。
  - **3D（薄荷 / 芙宁娜 / 星临者）**：mood + act（**约 40 个**：点头 / 摇头 / 歪头 / 左右看 / 鞠躬(深) / 前后倾身 / 左右扭腰 / 转身 / **原地转一圈** / 蹦跳 / 迈步 / 蹲下 / 踢腿 / 伸懒腰 / 挥手 / 双手挥手 / 欢呼 / 举手 / 指 / 比耶 / 敬礼 / 抱臂 / 叉腰 / 拍手 / 耸肩 / 害羞 / 思考…）+ **pose 姿态**（`arms=down|open|T|up|high`，`facing=front|left|right|back` 即 **360° 转向**）+ **`<bones>` 自由骨骼**（见下，AI 可任意摆姿势）。
- **3D 形象（真实动作数据）**：three.js + MMDLoader 渲染 `.pmx`。**手臂自动校准**——加载时实测模型绑定姿态（A-pose/T-pose 各不相同），再依此把手臂摆到自然垂放，**换任何模型都不会再把手臂转进身体里**（"胳膊没了"的根因）。待机采用 **MMD 标准动作数据（VMD）** 作为自然基底（真人级姿态：肘部自然弯曲、重心微移，不再僵硬"站岗"），AI 手势以增量叠加其上。含呼吸 / 眨眼 / **闲置随机小动作**，支持**拖动旋转、滚轮 / 双指缩放**（默认**不自转**）。
- **灵动的消息系统**：头顶多气泡依次弹出（带小尾巴、轻微浮动，永不越界）；输入框上方消息区正常只放用户消息（一行），当 AI 回复太长 / 太多时自动接管；闲置自动隐藏。AI 也可用反斜杠 `\` 主动把回复分成多条气泡。
- **记忆功能**：上下文窗口 + **滚动摘要自动压缩**，长期记忆不丢。
- **移动端友好**：响应式不溢出；输入框随软键盘**上浮覆盖**（不压缩模型）；可一键收起 / 展开。
- **深色模式**：跟随系统，**无白闪、背景稳定**（首帧前定好主题；模型画布不自带重复渐变、不做无谓 GPU 合成，久置也不闪）。
- **语音（TTS）**：默认**关闭**；开启后用浏览器内置语音（自动挑中文神经音色），也可用 OpenAI 兼容 `/audio/speech`；右上角喇叭按钮随时开 / 关；说话时口型同步。

## 🚀 使用

直接打开 `index.html`（建议用本地静态服务器，如 `python3 -m http.server`），或部署到 GitHub Pages。

首次配置：点击右上角 ⚙️ → **AI 接口**，填写 `Base URL / API Key / 模型名`，点「测试连接」。所有配置仅存于你浏览器的 localStorage，不会上传。

## 🎛 控制协议（AI 如何驱动身体）

开启「自动附加身体 / 动作说明」后，系统会把当前模型的能力清单拼进提示词，AI 会在回复开头输出若干会被隐藏的标签：

```
<mood>happy</mood><act>arm_wave,smile</act>
<pose>arms=down,facing=front</pose>
嗨～你来啦！\今天想和我聊点什么呀？
```

- **mood**：happy / excited / calm / shy / sad / angry / surprised / thinking / neutral
- **act**：见上（Live2D 与 3D 各自一套，提示词里会列出）
- **pose**：Live2D 用内置表情名（如 `smile` / `shy` / `think`；镜流有 `yandai` 戴眼罩）；3D 用 `arms=…,facing=…`
- **bones（3D · MPL 风格，可选进阶）**：AI 直接对任意骨骼下语义指令，真正"接管"身体：
  ```
  <bones>arm_r raise up 150; head turn left 25; leg_l bend forward 30; knee_r bend backward 60</bones>
  ```
  骨骼：`head / neck / upper_body / waist·lower_body / center·base(位移) / arm_l·arm_r / elbow_l·elbow_r / wrist_l·wrist_r / leg_l·leg_r / knee_l·knee_r / ankle_l·ankle_r`；
  动作与方向：`bend forward|backward`、`turn left|right`、`sway left|right`、`move`(仅 center/base)、手臂 `raise up|down`。
  （语法移植自开源项目 **AmyangXYZ/MMD-MPL** 的 MPL 动作语言。）
- **多气泡**：用反斜杠 `\` 分段，每段一个气泡

## 🤔 回答两个常见疑问

**为什么有的模型"能动得多"？** 动到什么程度取决于模型本身的**绑定**（参数 / 骨骼、范围）；「怎么动」由程序与 AI 决定。本项目把每个模型的能力**整理成提示词交给 AI**，所以换了模型，AI 也能立刻知道该模型能做什么。安An 额外带 19 个内置表情，所以"花样"更多。

**网页端 AI 驱动只能 Live2D 吗？不只是。** 3D / MMD 同样可行（本项目已用 three.js 的 `MMDLoader` 直接加载 `.pmx`）。参考项目：用 LLM 生成语义姿态驱动 MMD 的 **PoPo**（MMD Pose Language）、**DLP3D**、**lobe-vidol**、文本驱动 VRM 的 **Text-To-VRMA**，以及文本生成人体动作的 **HY-Motion / MoMask** 等。本项目的 `<bones>` 语义骨骼指令即移植自 **AmyangXYZ/MMD-MPL**（MPL 动作语言）。

## 🗂 目录结构

```
index.html
assets/
  css/style.css
  js/  config.js(模型注册表/设置/人设/每模型控制协议) memory.js(记忆压缩)
       motion.js(Live2D 动作引擎) live2d.js(Live2D 控制) mmd3d.js(3D/MMD 控制)
       tts.js llm.js app.js
       lib/  pixi.js · pixi-live2d-display(cubism4) · live2dcubismcore
       lib/three/  three.module.min.js · loaders/MMDLoader.js · shaders · libs/mmdparser
  model/anan/    AnAn.moc3 · textures/ · expressions/ …
  model/jingliu/ jingliu.moc3 · textures/ · expressions/ …   (镜流)
  model/motions/ stand.vmd (MMD 标准待机动作数据)
  model/mint/    model.pmx · textures/ …
  model/fu/    fu.pmx · tex/ · sph/ …   (芙宁娜)
  model/star/  star.pmx · textures/ …   (星临者)
  favicon.*
```

## 📜 模型版权

- **安An**：为《魔法少女的魔女审判》二次创作同人模型，由 B 站 @万童Official / @断夏Official 联合出品，完全免费分享（<https://yamawamandou.booth.pm/>）。请勿用于商业用途。
- **镜流**：用户提供的第三方 Live2D 模型（鸣潮 / 镜流主题），请遵循其原始授权。
- **薄荷**：用户提供的第三方免费模型，请遵循其原始授权（资源内已注明借物表 / 使用限制）。
- **芙宁娜**：原神同人改造模型（模型提供 miHoYo / 改造 @观海子），禁止二次配布、禁止商用。
- **星临者·绮夜誓仪**：《蓝色星原：旅谣》同人模型（模型编辑 @耶栗Yaki），禁止二次配布、禁止商用、禁止拆件挪用。

请在你的使用场景中尊重原作者的授权条款。
