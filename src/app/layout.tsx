import type { Metadata } from "next";
import { Orbitron, Rajdhani } from "next/font/google";

import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "JARVIS 2.0 | Adaptive AI Command System",
  description:
    "Cinematic AI assistant with memory, voice, productivity, and real-time intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${orbitron.variable} ${rajdhani.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
