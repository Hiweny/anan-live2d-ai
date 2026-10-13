/* ═══════════════════════════════════════════════════════════
   memory.js — 记忆与上下文窗口
   策略：滚动摘要（rolling summary）。
   - 保留最近 N 轮对话原文；
   - 上下文估算超过窗口阈值时，把更早的对话交给模型压缩成一段「摘要」，
     然后从历史里移除这些旧消息，窗口重新计数。
   - 摘要作为系统消息的一部分注入，保证长期记忆不丢。
   ═══════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";
  const AnAn = (root.AnAn = root.AnAn || {});

  /* 粗略 token 估算：CJK 约 1.6 字/token，其它约 4 字符/token */
  AnAn.estimateTokens = function (text) {
    if (!text) return 0;
    let cjk = 0, other = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c >= 0x2e80) cjk++; else other++;
    }
    return Math.ceil(cjk / 1.6 + other / 4);
  };

  /* 估算一次请求的上下文 token：系统提示 + 摘要 + 历史 + 新消息 */
  AnAn.contextTokens = function (sys, state, userText) {
    let n = AnAn.estimateTokens(sys) + AnAn.estimateTokens(state.summary || "");
    (state.history || []).forEach(function (m) {
      n += AnAn.estimateTokens(m.content) + 4;
    });
    n += AnAn.estimateTokens(userText) + 4;
    return n;
  };

  /* 组装发送给模型的 messages */
  AnAn.buildContext = function (sys, state, userText) {
    let system = sys;
    if (state.summary) system += "\n\n【你们之前聊天的记忆摘要】\n" + state.summary;
    const msgs = [{ role: "system", content: system }];
    (state.history || []).forEach(function (m) { msgs.push({ role: m.role, content: m.content }); });
    if (userText != null) msgs.push({ role: "user", content: userText });
    return msgs;
  };

  /* 是否需要压缩 */
  AnAn.needCompact = function (sys, state, settings) {
    const win = settings.ctxWindow || 8000;
    const keep = Math.max(2, (settings.keepRecent || 6) * 2);
    if ((state.history || []).length <= keep + 2) return false;
    return AnAn.contextTokens(sys, state, "") > win * 0.85;
  };

  /* 执行压缩：把较旧的对话浓缩进 state.summary，并裁剪 history */
  AnAn.compact = async function (llm, settings, state, sys) {
    const keep = Math.max(2, (settings.keepRecent || 6) * 2);
    const hist = state.history || [];
    if (hist.length <= keep + 2) return { compacted: false };
    const older = hist.slice(0, hist.length - keep);
    const recent = hist.slice(-keep);
    const convo = older.map(function (m) { return (m.role === "user" ? "用户：" : "角色：") + m.content; }).join("\n");
    const prompt = [
      { role: "system", content: "你是一个对话记忆压缩器。请把给定的对话浓缩为一段紧凑的要点摘要，务必保留：人物设定、用户的偏好与事实、重要结论、尚未完成的事、以及情绪基调。用第三人称、简体中文书写，不要编造，不要评论。只输出摘要正文，长度不超过 300 字。" },
      { role: "user", content: "【已有摘要】\n" + (state.summary || "（无）") + "\n\n【需要并入摘要的较早对话】\n" + convo }
    ];
    let out = "";
    try {
      const r = await llm.chat({ messages: prompt, stream: false, onDone: function () {} });
      out = (r && r.content || "").trim();
    } catch (e) {
      AnAn.log("记忆压缩失败", e);
      return { compacted: false, error: String(e && e.message || e) };
    }
    if (out) state.summary = out.slice(0, 800);
    state.history = recent;
    return { compacted: true, summary: state.summary };
  };

  /* 清空记忆 */
  AnAn.clearMemory = function (state) { state.history = []; state.summary = ""; };
})(window);
