# JARVIS 2.0

 futuristic AI command system built with Next.js, Tailwind CSS, Framer Motion, OpenAI, and MongoDB.

It is designed to feel like a personal AI operating system, not a basic chatbot.

## Core Features

- Real-time streaming chat responses
- Multi-turn conversation memory
- Voice input (Speech-to-Text) + voice output (Text-to-Speech)
- Optional wake word mode: `Hey JARVIS`
- Smart dashboard: time, weather, live client system stats
- File upload + context-aware code/file analysis
- Productivity suite: tasks, notes, reminders
- Internet knowledge mode (live snippets via web retrieval)
- Personal training system with:
  - Short-term conversational context
  - Long-term memory in MongoDB
  - Optional semantic memory (embeddings)
- --Command mode::
  - `/remember <text>`
  - `/forget <text>`
  - `/update <field>: <value>`
  - `/clear memory`
  - `/summarize <text>`
- Training modes:
  - Passive Mode (auto-learning)
  - Manual Mode (learns via commands)
  - Focus Mode (high-signal responses)
- Theme switcher: `JARVIS` / `FRIDAY`
- Keyboard shortcuts
- User-owned memory with export and delete controls

## UI Component Design

### 1) Left Control Panel

- Agent selector: General / Coder / Study / Research
- Tone selector: Professional / Friendly / Technical
- Training mode selector
- Toggles:
  - Knowledge mode
  - Auto-learning
  - Wake word
  - Voice output
- Theme switcher: JARVIS / FRIDAY
- Keyboard shortcuts reference

### 2) Center Chat Core

- Animated message timeline
- Markdown-enabled assistant output
- Streaming token rendering + typing cursor
- AI thinking indicator
- Quick action command chips
- Voice waveform when listening
- File upload chips + context injection

### 3) Right Intelligence Rail

- Dashboard widgets (clock/weather/system metrics)
- Memory & training panel (view/edit/delete/clear)
- Productivity panel (tasks/notes/reminders)
- AI insight cards (weak subjects/emotions/study patterns)
- Privacy actions (export/delete user data)

## Folder Structure

```txt
src/
  app/
    api/
      chat/route.ts
      export/route.ts
      history/route.ts
      memory/route.ts
      memory/[id]/route.ts
      productivity/route.ts
      settings/route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    jarvis-console.tsx
    message-bubble.tsx
    typing-indicator.tsx
    voice-waveform.tsx
  lib/
    auto-learning.ts
    commands.ts
    constants.ts
    db.ts
    memory.ts
    openai.ts
    prompt.ts
    utils.ts
    web-search.ts
  models/
    Conversation.ts
    Memory.ts
    ProductivityItem.ts
    UserProfile.ts
  types/
    index.ts
```

## Setup Instructions

## 1) Install

```bash
npm install
```

## 2) Configure environment

```bash
cp .env.example .env.local
```

Fill these values:

- `OPENAI_API_KEY` (required for AI responses)
- `MONGODB_URI` (required for persistent memory/training/history/productivity)
- Optional:
  - `OPENAI_MODEL`
  - `ENABLE_SEMANTIC_MEMORY`
  - `OPENAI_EMBEDDING_MODEL`

## 3) Run

```bash
npm run dev
```

Open: `http://localhost:3000`

## Personal Training System Details

### Memory layers

- Short-term: recent multi-turn messages included in each prompt
- Long-term: structured memory documents in MongoDB
- Semantic memory: optional embedding-based retrieval when enabled

### Learning behavior

- Passive Mode: auto-extracts signals (e.g. weak subjects, preferences, emotional signals)
- Manual Mode: learns only through slash commands
- Focus Mode: prioritizes concise, high-signal responses

### Retrieval flow

Before each response:

1. Relevant memories are ranked and fetched
2. Knowledge snippets are fetched if knowledge mode is ON
3. Prompt is dynamically assembled with memory + context + selected agent/tone/mode

## Deployment Guide (GitHub + Vercel)

## 1) Push to GitHub

```bash
git init
git add .
git commit -m "feat: jarvis 2.0 adaptive ai system"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## 2) Deploy on Vercel

1. Import the GitHub repository in Vercel
2. Framework preset: `Next.js`
3. Set Node version to `20.x` in Vercel Project Settings -> General -> Node.js Version
4. Add environment variables in Vercel project settings:
   - `OPENAI_API_KEY`
   - `MONGODB_URI`
   - `OPENAI_MODEL` (optional)
   - `ENABLE_SEMANTIC_MEMORY` (optional)
   - `OPENAI_EMBEDDING_MODEL` (optional)
5. Deploy

No special build command is required.

### CLI Deployment (Optional)

```bash
npx vercel login
npx vercel link
npx vercel env add OPENAI_API_KEY production
npx vercel env add MONGODB_URI production
npx vercel env add OPENAI_MODEL production
npx vercel --prod
```

### Post-Deploy Verification

After deploy, open:

- `https://<your-project>.vercel.app/api/health`

Expected:

- `OPENAI_API_KEY: "set"`
- `MONGODB_URI: "set"`

If either is `"missing"`, add env vars in Vercel and redeploy.

### Common Vercel Failures

- `No Project Settings found locally`:
  - Run `npx vercel pull --yes` (or use dashboard deploy).
- `Incorrect API key provided`:
  - Replace `OPENAI_API_KEY` in Vercel with a real key and redeploy.
- Chat timing out:
  - `chat` route is already configured with `maxDuration = 60` for streaming.

## Browser Notes

- Voice input/output depends on browser Web Speech API support (best in Chromium browsers)
- Wake word mode uses transcript matching (`Hey JARVIS ...`) rather than continuous background hotword detection

## Command Examples

- `/remember I study best at night`
- `/update weak_subject: Organic Chemistry`
- `/forget Organic Chemistry`
- `/clear memory`
- `/summarize <paste long text>`

## Tech Stack

- Frontend: Next.js App Router, React, Tailwind CSS, Framer Motion
- Backend: Next.js API routes (serverless-ready)
- AI: OpenAI Chat Completions streaming
- Database: MongoDB + Mongoose
- Voice: Web Speech API (STT + TTS)
