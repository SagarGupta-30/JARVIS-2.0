"use client";

import { motion } from "framer-motion";

type Props = {
  active: boolean;
};

export function VoiceWaveform({ active }: Props) {
  if (!active) {
    return null;
  }

  return (
    <div className="flex items-end gap-1 rounded-xl border border-cyan-400/25 bg-cyan-500/8 px-3 py-2">
      {Array.from({ length: 12 }).map((_, index) => (
        <motion.span
          key={index}
          className="block w-1 rounded-full bg-cyan-300/85"
          animate={{
            height: [6, 22, 10, 18, 8],
            opacity: [0.35, 0.95, 0.55, 0.9, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: index * 0.05,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
