"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatMessage from "@/components/ChatMessage";
import StarField from "@/components/StarField";

const EXAMPLE_QUESTIONS = [
  "What are the main challenges of sending humans to Mars?",
  "What does NASA say about life support on Mars missions?",
  "What technologies are needed for sustainable Mars exploration?",
];

export default function ChatPage() {
  // ai@6: useChat defaults to /api/chat via DefaultChatTransport.
  // Manage input state manually — handleSubmit/handleInputChange were removed in v6.
  const { messages, sendMessage, status, error } = useChat();

  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const isLoading = status === "submitted" || status === "streaming";

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage({ text: trimmed });
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden relative scanlines">

      {/* ── Fixed backgrounds ──────────────────────────────────────────────── */}
      <div className="fixed inset-0 space-bg z-0" />
      <StarField />

      {/* Ambient nebula blobs */}
      <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="nebula-1 absolute -top-56 -right-56 w-[600px] h-[600px] rounded-full bg-purple-900/18 blur-3xl" />
        <div className="nebula-2 absolute top-1/2 -left-48 w-96 h-96 rounded-full bg-indigo-900/14 blur-3xl" />
        <div className="nebula-3 absolute -bottom-32 right-1/3 w-80 h-80 rounded-full bg-rose-950/12 blur-3xl" />
      </div>

      {/* ── Page fade-in wrapper ───────────────────────────────────────────── */}
      <motion.div
        className="relative z-10 flex flex-col h-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 glass-header px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-4">

            {/* Logo mark */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full border border-purple-700/40 bg-purple-950/40 flex items-center justify-center text-xl shadow-lg shadow-purple-950/50">
              🛸
            </div>

            {/* Title block */}
            <div className="flex-1 min-w-0">
              <h1 className="gradient-title text-sm font-bold tracking-[0.12em] uppercase">
                Mars AI Mission Control
              </h1>
              <p className="text-[11px] text-purple-400/55 mt-0.5 tracking-wide">
                Ask anything about Mars exploration
              </p>
            </div>

          </div>
        </header>

        {/* ── Message list ────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto chat-scroll px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-5">

            {/* Empty state */}
            <AnimatePresence>
              {messages.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="text-center pt-12 pb-4"
                >
                  {/* Hero icon */}
                  <motion.div
                    className="flex justify-center mb-8"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 160 }}
                  >
                    <div className="w-24 h-24 rounded-full bg-purple-950/50 border border-purple-700/30 flex items-center justify-center text-5xl shadow-2xl shadow-purple-950/60">
                      🪐
                    </div>
                  </motion.div>

                  {/* Divider label */}
                  <div className="flex items-center gap-3 mb-5 max-w-sm mx-auto">
                    <div className="flex-1 h-px bg-purple-800/30" />
                    <span className="text-[10px] font-mono tracking-[0.25em] text-purple-500/50 uppercase">
                      Mission Briefing
                    </span>
                    <div className="flex-1 h-px bg-purple-800/30" />
                  </div>

                  <p className="text-purple-200/55 text-sm mb-1">
                    Your AI guide to NASA&apos;s Mars exploration program.
                  </p>
                  <p className="text-purple-400/35 text-xs mb-8">
                    Select an objective below or compose your own query.
                  </p>

                  {/* Example question cards */}
                  <div className="flex flex-col gap-3 items-center">
                    {EXAMPLE_QUESTIONS.map((q, i) => (
                      <motion.button
                        key={q}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 + i * 0.08, duration: 0.35 }}
                        whileHover={{
                          scale: 1.015,
                          borderColor: "rgba(139, 92, 246, 0.55)",
                          backgroundColor: "rgba(88, 28, 135, 0.18)",
                        }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => submitMessage(q)}
                        className="group text-sm text-purple-300/65 border border-purple-800/35 bg-purple-950/15 rounded-xl px-5 py-3 max-w-md w-full text-left flex items-start gap-3 transition-colors"
                      >
                        <span className="text-purple-600/50 group-hover:text-purple-400 font-mono text-xs mt-0.5 flex-shrink-0 transition-colors">
                          →
                        </span>
                        {q}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat messages */}
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 180, damping: 24 }}
                >
                  <ChatMessage message={m} />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 border border-purple-500/30 flex items-center justify-center text-sm mt-1 shadow-md shadow-purple-950/50">
                    🛸
                  </div>
                  <div className="bubble-ai rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-2">
                    <span className="dot-bounce w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="dot-bounce w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="dot-bounce w-1.5 h-1.5 rounded-full bg-purple-400" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-red-800/50 bg-red-950/25 backdrop-blur-sm px-5 py-3.5 text-sm text-red-400/90"
                >
                  {error.message ||
                    "Something went wrong. Check that env vars are set and Supabase has ingested documents."}
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        </main>

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <footer className="flex-shrink-0 glass-footer px-4 py-4">
          <div className="max-w-3xl mx-auto flex gap-3 items-end">

            {/* Input with animated glow */}
            <motion.div
              className="flex-1 rounded-2xl overflow-hidden"
              animate={{
                boxShadow: inputFocused
                  ? "0 0 0 1.5px rgba(139, 92, 246, 0.55), 0 0 28px rgba(139, 92, 246, 0.14)"
                  : "0 0 0 1px rgba(139, 92, 246, 0.18)",
              }}
              transition={{ duration: 0.18 }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about NASA Mars missions, rovers, science goals…"
                rows={1}
                disabled={isLoading}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitMessage(input);
                  }
                }}
                className="w-full resize-none bg-purple-950/28 px-5 py-3.5 text-sm text-purple-100 placeholder-purple-500/40 focus:outline-none disabled:opacity-50 transition-colors"
              />
            </motion.div>

            {/* Send button */}
            <motion.button
              type="button"
              onClick={() => submitMessage(input)}
              disabled={isLoading || !input.trim()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex-shrink-0 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 disabled:opacity-35 disabled:cursor-not-allowed px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-950/50 hover:shadow-purple-700/40"
            >
              <span className="flex items-center gap-2">
                <span>Send</span>
                <span className="text-base leading-none">🚀</span>
              </span>
            </motion.button>
          </div>

          <p className="max-w-3xl mx-auto mt-2 text-center text-[10px] font-mono text-purple-700/45 tracking-wider">
            ENTER TO SEND · SHIFT+ENTER FOR NEW LINE
          </p>
        </footer>

      </motion.div>
    </div>
  );
}
