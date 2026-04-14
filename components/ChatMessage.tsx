"use client";

import { motion } from "framer-motion";
import type { UIMessage } from "ai";

interface Props {
  message: UIMessage;
}

/**
 * Renders a single chat message (user or assistant).
 * Extracts text parts and displays them with simple formatting.
 * The assistant's "Sources:" block is rendered with a slightly dimmed style
 * to visually separate citations from the main answer.
 */
export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  // Collect all text parts from the message
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");

  // Split at "Sources:" so we can style the citation block separately
  const sourcesIndex = text.indexOf("Sources:");
  const mainText =
    sourcesIndex !== -1 ? text.slice(0, sourcesIndex).trim() : text;
  const sourcesText = sourcesIndex !== -1 ? text.slice(sourcesIndex) : null;

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>

      {/* AI avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-700 to-indigo-800 border border-purple-500/30 flex items-center justify-center text-sm mt-1 shadow-md shadow-purple-950/50">
          🛸
        </div>
      )}

      <div
        className={`max-w-[80%] space-y-2 flex flex-col ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {/* Main bubble */}
        <motion.div
          whileHover={{ scale: 1.008 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`rounded-2xl px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bubble-user text-purple-50 rounded-tr-none"
              : "bubble-ai text-slate-100 rounded-tl-none"
          }`}
        >
          {mainText}
        </motion.div>

        {/* Sources block — assistant only. Hidden when sources are empty or "None". */}
        {!isUser && sourcesText && !/none/i.test(sourcesText.replace("Sources:", "").trim()) && (
          <div className="sources-block rounded-xl px-4 py-3 text-xs text-purple-400/65 whitespace-pre-wrap w-full font-mono leading-relaxed">
            {sourcesText}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-200 mt-1 shadow-md shadow-purple-950/50">
          U
        </div>
      )}
    </div>
  );
}
