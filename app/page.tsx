"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import ChatMessage from "@/components/ChatMessage";

const EXAMPLE_QUESTIONS = [
  "What are the main science goals of the Perseverance rover?",
  "How does NASA plan to return samples from Mars?",
  "What challenges does human Mars exploration face?",
];

export default function ChatPage() {
  // ai@6: useChat defaults to /api/chat via DefaultChatTransport.
  // Manage input state manually — handleSubmit/handleInputChange were removed in v6.
  const { messages, sendMessage, status, error } = useChat();

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to latest message
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
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-zinc-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3 flex-wrap">
          <span className="rounded-full bg-red-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-400">
            NASA · Mars · RAG
          </span>
          <h1 className="text-base font-semibold text-zinc-100">
            Mars Mission Chatbot
          </h1>
          <span className="ml-auto text-xs text-zinc-500 hidden sm:block">
            Answers grounded in official NASA documents
          </span>
        </div>
      </header>

      {/* Message list */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Empty state with example questions */}
          {messages.length === 0 && (
            <div className="text-center space-y-6 pt-12">
              <p className="text-zinc-400 text-sm">
                Ask anything about NASA&apos;s Mars exploration program.
                <br />
                Answers are retrieved from official NASA documents.
              </p>
              <div className="flex flex-col gap-2 items-center">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => submitMessage(q)}
                    className="text-sm text-zinc-400 border border-zinc-700 rounded-xl px-4 py-2 hover:bg-zinc-800 hover:text-zinc-200 transition-colors max-w-md w-full text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}

          {/* Streaming indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-red-900/60 flex items-center justify-center text-xs font-bold text-red-300 mt-1 flex-shrink-0">
                M
              </div>
              <div className="bg-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-zinc-400">
                <span className="animate-pulse">Retrieving context and generating answer…</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              {error.message || "Something went wrong. Check that env vars are set and Supabase has ingested documents."}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input bar */}
      <footer className="flex-shrink-0 border-t border-zinc-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about NASA Mars missions, rovers, science goals…"
            rows={1}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitMessage(input);
              }
            }}
            className="flex-1 resize-none rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-700 disabled:opacity-50 transition-colors"
          />
          <button
            type="button"
            onClick={() => submitMessage(input)}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 rounded-xl bg-red-800 hover:bg-red-700 disabled:opacity-40 px-5 py-3 text-sm font-medium text-white transition-colors"
          >
            Send
          </button>
        </div>
        <p className="max-w-3xl mx-auto mt-2 text-center text-xs text-zinc-600">
          Enter to send · Shift+Enter for new line
        </p>
      </footer>
    </div>
  );
}
