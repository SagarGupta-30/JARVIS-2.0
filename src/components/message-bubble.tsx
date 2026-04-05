"use client";

import clsx from "clsx";
import ReactMarkdown from "react-markdown";

import type { ChatMessage } from "@/types";

type Props = {
  message: ChatMessage;
  streaming?: boolean;
};

export function MessageBubble({ message, streaming = false }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={clsx("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-relaxed md:max-w-[82%]",
          isUser
            ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-50"
            : "border-white/15 bg-white/5 text-slate-100",
        )}
      >
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-cyan-300/75">
          {isUser ? "Operator" : "JARVIS"}
        </div>
        <div className="prose prose-invert prose-p:my-2 prose-pre:my-2 prose-pre:max-h-80 prose-pre:overflow-auto prose-code:text-cyan-200 prose-ul:my-2 prose-ol:my-2 prose-headings:my-2 max-w-none break-words">
          <ReactMarkdown>{message.content || "..."}</ReactMarkdown>
          {streaming && !isUser ? (
            <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-cyan-300 align-middle" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
