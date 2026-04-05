"use client";

import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/8 px-3 py-2 text-xs uppercase tracking-[0.2em] text-cyan-200">
      <span>AI Thinking</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-cyan-300"
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: index * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}
