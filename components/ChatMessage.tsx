"use client";

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
  const mainText = sourcesIndex !== -1 ? text.slice(0, sourcesIndex).trim() : text;
  const sourcesText = sourcesIndex !== -1 ? text.slice(sourcesIndex) : null;

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-900/60 flex items-center justify-center text-xs font-bold text-red-300 mt-1">
          M
        </div>
      )}

      <div className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Main answer bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-red-900/30 text-white rounded-tr-none"
              : "bg-zinc-800 text-zinc-100 rounded-tl-none"
          }`}
        >
          {mainText}
        </div>

        {/* Sources block — only shown on assistant messages */}
        {!isUser && sourcesText && (
          <div className="rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-2 text-xs text-zinc-400 whitespace-pre-wrap w-full">
            {sourcesText}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 mt-1">
          U
        </div>
      )}
    </div>
  );
}
