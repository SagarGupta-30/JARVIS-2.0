"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bell,
  Bot,
  BrainCircuit,
  Check,
  Cloud,
  Code2,
  Cpu,
  Download,
  Eraser,
  Flame,
  Globe,
  GraduationCap,
  Mic,
  MicOff,
  NotebookPen,
  Pencil,
  Plus,
  Send,
  Settings2,
  Sparkles,
  TerminalSquare,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from "lucide-react";

import { MessageBubble } from "@/components/message-bubble";
import { TypingIndicator } from "@/components/typing-indicator";
import { VoiceWaveform } from "@/components/voice-waveform";
import {
  AGENT_OPTIONS,
  DEFAULT_USER_ID,
  STORAGE_KEYS,
  TONE_OPTIONS,
  TRAINING_MODES,
  VOICE_GENDER_OPTIONS,
  VOICE_LANGUAGE_OPTIONS,
} from "@/lib/constants";
import { useHudSfx } from "@/lib/hud-sfx";
import { createId, formatModeLabel } from "@/lib/utils";
import type {
  AgentMode,
  ChatMessage,
  ClientSystemStats,
  MemoryItem,
  ProductivityItem,
  ProductivityType,
  UploadedContextFile,
  UserSettings,
  WeatherSnapshot,
} from "@/types";

type JarvisSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => JarvisSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const WEATHER_CODE_LOOKUP: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  61: "Rain",
  71: "Snow",
  80: "Rain showers",
  95: "Thunderstorm",
};

const QUICK_ACTIONS: Array<{ label: string; command: string; icon: typeof Sparkles }> = [
  { label: "Optimize Code", command: "optimize code: ", icon: Code2 },
  { label: "Analyze This", command: "analyze this: ", icon: TerminalSquare },
  { label: "Study Plan", command: "create a focused study plan for ", icon: GraduationCap },
  { label: "Research Mode", command: "summarize latest updates on ", icon: Globe },
];

const DEFAULT_SETTINGS: UserSettings = {
  userId: DEFAULT_USER_ID,
  agent: "general",
  knowledgeMode: false,
  preferences: {
    responseTone: "professional",
    theme: "jarvis",
    wakeWordEnabled: false,
    voiceGender: "female",
    voiceLanguage: "bilingual",
  },
  training: {
    autoLearning: true,
    mode: "passive",
  },
};

function normalizeSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    preferences: {
      responseTone:
        settings.preferences?.responseTone ?? DEFAULT_SETTINGS.preferences.responseTone,
      theme: settings.preferences?.theme ?? DEFAULT_SETTINGS.preferences.theme,
      wakeWordEnabled:
        settings.preferences?.wakeWordEnabled ??
        DEFAULT_SETTINGS.preferences.wakeWordEnabled,
      voiceGender:
        settings.preferences?.voiceGender ?? DEFAULT_SETTINGS.preferences.voiceGender,
      voiceLanguage:
        settings.preferences?.voiceLanguage ??
        DEFAULT_SETTINGS.preferences.voiceLanguage,
    },
    training: {
      autoLearning:
        settings.training?.autoLearning ?? DEFAULT_SETTINGS.training.autoLearning,
      mode: settings.training?.mode ?? DEFAULT_SETTINGS.training.mode,
    },
  };
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Systems online. I am JARVIS. I can reason, code, analyze files, remember what matters, and adapt to your workflow. What should we optimize first?",
  createdAt: new Date().toISOString(),
};

function classesForTheme(theme: "jarvis" | "friday") {
  return theme === "jarvis"
    ? "from-cyan-500/15 via-slate-950 to-[#02040a]"
    : "from-rose-500/10 via-slate-950 to-[#040409]";
}

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window.SpeechRecognition || window.webkitSpeechRecognition) ?? null;
}

const FEMALE_VOICE_HINTS = [
  "female",
  "woman",
  "zira",
  "aria",
  "siri",
  "priya",
  "raveena",
  "aasha",
  "heera",
  "alloy-f",
];

const MALE_VOICE_HINTS = [
  "male",
  "man",
  "david",
  "mark",
  "alex",
  "guy",
  "prabhat",
  "raj",
  "alloy-m",
];

function getVoiceOutputLanguage(
  text: string,
  mode: UserSettings["preferences"]["voiceLanguage"],
) {
  if (mode === "hi") {
    return "hi";
  }

  if (mode === "en") {
    return "en";
  }

  return /[\u0900-\u097F]/.test(text) ? "hi" : "en";
}

function getRecognitionLanguage(mode: UserSettings["preferences"]["voiceLanguage"]) {
  if (mode === "hi") {
    return "hi-IN";
  }

  if (mode === "en") {
    return "en-US";
  }

  return "en-IN";
}

function pickBestVoice(input: {
  voices: SpeechSynthesisVoice[];
  language: "en" | "hi";
  gender: UserSettings["preferences"]["voiceGender"];
}) {
  const langPref =
    input.language === "hi"
      ? ["hi-in", "hi"]
      : ["en-in", "en-us", "en-gb", "en"];

  let winner: SpeechSynthesisVoice | null = null;
  let winnerScore = Number.NEGATIVE_INFINITY;

  for (const voice of input.voices) {
    const lang = (voice.lang || "").toLowerCase();
    const name = (voice.name || "").toLowerCase();

    const langIndex = langPref.findIndex(
      (tag) => lang.startsWith(tag) || lang.includes(tag),
    );
    if (langIndex === -1) {
      continue;
    }

    let score = 100 - langIndex * 10;

    if (input.gender !== "auto") {
      const femaleHit = FEMALE_VOICE_HINTS.some((hint) => name.includes(hint));
      const maleHit = MALE_VOICE_HINTS.some((hint) => name.includes(hint));

      if (input.gender === "female") {
        if (femaleHit) score += 18;
        if (maleHit) score -= 8;
      }

      if (input.gender === "male") {
        if (maleHit) score += 18;
        if (femaleHit) score -= 8;
      }
    }

    if (/google|microsoft|neural|enhanced|premium/.test(name)) {
      score += 4;
    }
    if (voice.localService) {
      score += 2;
    }
    if (voice.default) {
      score += 1;
    }

    if (score > winnerScore) {
      winner = voice;
      winnerScore = score;
    }
  }

  return winner;
}

export function JarvisConsole() {
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [items, setItems] = useState<ProductivityItem[]>([]);

  const [input, setInput] = useState("");
  const [manualMemoryInput, setManualMemoryInput] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemType, setNewItemType] = useState<ProductivityType>("task");
  const [newReminderDate, setNewReminderDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [weather, setWeather] = useState<WeatherSnapshot>({});
  const [systemStats, setSystemStats] = useState<ClientSystemStats>({});
  const [now, setNow] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  const [voiceOutput, setVoiceOutput] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>(
    [],
  );
  const [activeVoiceLabel, setActiveVoiceLabel] = useState("System default");

  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryText, setEditingMemoryText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const memoryPanelRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<JarvisSpeechRecognition | null>(null);
  const [contextFiles, setContextFiles] = useState<UploadedContextFile[]>([]);
  const { play: playSfx, prime: primeSfx } = useHudSfx(soundEffectsEnabled);

  const isVoiceSupported = isClient && !!getSpeechRecognitionCtor();

  const refreshAll = useCallback(
    async (activeUserId: string) => {
      const [settingsRes, memoryRes, historyRes, itemsRes] = await Promise.all([
        fetch(`/api/settings?userId=${activeUserId}`, { cache: "no-store" }),
        fetch(`/api/memory?userId=${activeUserId}`, { cache: "no-store" }),
        fetch(`/api/history?userId=${activeUserId}&limit=60`, { cache: "no-store" }),
        fetch(`/api/productivity?userId=${activeUserId}`, { cache: "no-store" }),
      ]);

      if (settingsRes.ok) {
        const data = (await settingsRes.json()) as { settings: UserSettings };
        setSettings(normalizeSettings(data.settings));
      }

      if (memoryRes.ok) {
        const data = (await memoryRes.json()) as { memories: MemoryItem[] };
        setMemories(data.memories);
      }

      if (historyRes.ok) {
        const data = (await historyRes.json()) as { messages: ChatMessage[] };
        if (data.messages.length) {
          setMessages(data.messages);
        }
      }

      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as { items: ProductivityItem[] };
        setItems(data.items);
      }
    },
    [],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.userId);
    const resolved = stored || createId("operator");
    window.localStorage.setItem(STORAGE_KEYS.userId, resolved);
    setUserId(resolved);

    const storedSoundMode = window.localStorage.getItem(STORAGE_KEYS.soundEffects);
    if (storedSoundMode === "off") {
      setSoundEffectsEnabled(false);
    }

    const storedVoiceGender = window.localStorage.getItem(STORAGE_KEYS.voiceGender);
    const storedVoiceLanguage = window.localStorage.getItem(STORAGE_KEYS.voiceLanguage);

    setSettings((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        voiceGender:
          storedVoiceGender === "female" ||
          storedVoiceGender === "male" ||
          storedVoiceGender === "auto"
            ? storedVoiceGender
            : prev.preferences.voiceGender,
        voiceLanguage:
          storedVoiceLanguage === "en" ||
          storedVoiceLanguage === "hi" ||
          storedVoiceLanguage === "bilingual"
            ? storedVoiceLanguage
            : prev.preferences.voiceLanguage,
      },
    }));
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        await refreshAll(userId);
      } catch {
        if (!cancelled) {
          setError("Unable to load cloud state. Running local view.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [refreshAll, userId]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.preferences.theme;
  }, [settings.preferences.theme]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !window.speechSynthesis) {
      return;
    }

    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const voices = synth.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    const timer = window.setTimeout(loadVoices, 300);
    synth.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.clearTimeout(timer);
      synth.removeEventListener("voiceschanged", loadVoices);
    };
  }, [isClient]);

  useEffect(() => {
    const previewLanguage = settings.preferences.voiceLanguage === "hi" ? "hi" : "en";
    const preview = pickBestVoice({
      voices: availableVoices,
      language: previewLanguage,
      gender: settings.preferences.voiceGender,
    });
    setActiveVoiceLabel(preview?.name ?? "System default");
  }, [
    availableVoices,
    settings.preferences.voiceGender,
    settings.preferences.voiceLanguage,
  ]);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.soundEffects,
      soundEffectsEnabled ? "on" : "off",
    );
  }, [isClient, soundEffectsEnabled]);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.voiceGender,
      settings.preferences.voiceGender,
    );
    window.localStorage.setItem(
      STORAGE_KEYS.voiceLanguage,
      settings.preferences.voiceLanguage,
    );
  }, [
    isClient,
    settings.preferences.voiceGender,
    settings.preferences.voiceLanguage,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`,
          );
          const weatherData = (await weatherRes.json()) as {
            current?: { temperature_2m?: number; weather_code?: number };
          };

          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`,
          );
          const geoData = (await geoRes.json()) as {
            results?: Array<{ name?: string; country?: string }>;
          };

          const place = geoData.results?.[0];

          setWeather({
            location: [place?.name, place?.country].filter(Boolean).join(", "),
            temperatureC: weatherData.current?.temperature_2m,
            condition:
              WEATHER_CODE_LOOKUP[weatherData.current?.weather_code ?? -1] ??
              "Unknown",
          });
        } catch {
          setWeather({
            location: "Unavailable",
            condition: "Weather feed unavailable",
          });
        }
      },
      () => {
        setWeather({
          location: "Location blocked",
          condition: "Enable geolocation for weather",
        });
      },
      { timeout: 8000, maximumAge: 120_000 },
    );
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { effectiveType?: string };
      getBattery?: () => Promise<{ level: number }>;
    };

    setSystemStats({
      cores: navigator.hardwareConcurrency,
      memoryGB: nav.deviceMemory,
      networkType: nav.connection?.effectiveType,
    });

    if (nav.getBattery) {
      void nav.getBattery().then((battery) => {
        setSystemStats((prev) => ({
          ...prev,
          battery: Math.round((battery.level ?? 0) * 100),
        }));
      });
    }
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        textAreaRef.current?.focus();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void sendMessage();
      }

      if (event.altKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        void toggleVoiceInput();
      }

      if (event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        memoryPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    if (!soundEffectsEnabled) {
      return;
    }

    const handler = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (!target.closest("button, .chip")) {
        return;
      }

      void primeSfx();
      playSfx("tap");
    };

    window.addEventListener("pointerdown", handler, { passive: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, [playSfx, primeSfx, soundEffectsEnabled]);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOutput || !window.speechSynthesis || !text.trim()) {
        return;
      }

      const finalText = text.slice(0, 520).trim();
      const language = getVoiceOutputLanguage(
        finalText,
        settings.preferences.voiceLanguage,
      );

      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(finalText);
      utterance.lang = language === "hi" ? "hi-IN" : "en-US";

      const matchedVoice = pickBestVoice({
        voices: availableVoices,
        language,
        gender: settings.preferences.voiceGender,
      });

      if (matchedVoice) {
        utterance.voice = matchedVoice;
        if (matchedVoice.lang) {
          utterance.lang = matchedVoice.lang;
        }
        setActiveVoiceLabel(matchedVoice.name);
      } else {
        setActiveVoiceLabel("System default");
      }

      if (language === "hi") {
        utterance.rate = 0.95;
        utterance.pitch = 1;
      } else {
        utterance.rate = 1.03;
        utterance.pitch = 1.02;
      }

      synth.speak(utterance);
    },
    [
      availableVoices,
      settings.preferences.voiceGender,
      settings.preferences.voiceLanguage,
      voiceOutput,
    ],
  );

  const patchSettings = useCallback(
    async (patch: {
      agent?: AgentMode;
      knowledgeMode?: boolean;
      preferences?: Partial<UserSettings["preferences"]>;
      training?: Partial<UserSettings["training"]>;
    }) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });

      if (response.ok) {
        const data = (await response.json()) as { settings: UserSettings };
        setSettings(normalizeSettings(data.settings));
      }
    },
    [userId],
  );

  const refreshMemories = useCallback(async () => {
    const response = await fetch(`/api/memory?userId=${userId}`, {
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as { memories: MemoryItem[] };
      setMemories(data.memories);
    }
  }, [userId]);

  const refreshItems = useCallback(async () => {
    const response = await fetch(`/api/productivity?userId=${userId}`, {
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as { items: ProductivityItem[] };
      setItems(data.items);
    }
  }, [userId]);

  const sendMessage = useCallback(async () => {
    if (sending) {
      return;
    }

    const prompt = input.trim();
    if (!prompt && !contextFiles.length) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      content: prompt || "Analyze the attached file context.",
      createdAt: new Date().toISOString(),
    };

    const assistantMessageId = createId("assistant");
    const draftAssistant: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setError(null);
    setSending(true);
    setStreamingMessageId(assistantMessageId);
    setInput("");
    playSfx("send");

    const outboundMessages = [...messages, userMessage];
    setMessages([...outboundMessages, draftAssistant]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          messages: outboundMessages,
          files: contextFiles,
          agent: settings.agent,
          knowledgeMode: settings.knowledgeMode,
          preferences: settings.preferences,
          training: settings.training,
        }),
      });

      if (!response.ok) {
        const raw = await response.text();
        let reason = `Request failed (${response.status})`;

        try {
          const parsed = JSON.parse(raw) as { error?: string; detail?: string };
          reason = parsed.error || parsed.detail || reason;
        } catch {
          if (raw.trim()) {
            reason = raw.trim().slice(0, 220);
          }
        }

        throw new Error(reason);
      }

      if (!response.body) {
        throw new Error("No streaming body received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        fullText += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: fullText,
                }
              : message,
          ),
        );
      }

      if (!fullText.trim()) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: "No response payload received.",
                }
              : message,
          ),
        );
      }

      playSfx("receive");
      speak(fullText);
      setContextFiles([]);
      await refreshMemories();
    } catch (streamError) {
      playSfx("error");
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content:
                  streamError instanceof Error
                    ? `Transmission failure: ${streamError.message}`
                    : "Transmission failure.",
              }
            : message,
        ),
      );
      setError(
        streamError instanceof Error
          ? streamError.message
          : "Unable to get response.",
      );
    } finally {
      setSending(false);
      setStreamingMessageId(null);
    }
  }, [
    contextFiles,
    input,
    messages,
    refreshMemories,
    sending,
    settings.agent,
    settings.knowledgeMode,
    settings.preferences,
    settings.training,
    playSfx,
    speak,
    userId,
  ]);

  const toggleVoiceInput = useCallback(async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      playSfx("voice_stop");
      return;
    }

    const Ctor = getSpeechRecognitionCtor();

    if (!Ctor) {
      setError("Speech recognition is not supported in this browser.");
      playSfx("error");
      return;
    }

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = getRecognitionLanguage(settings.preferences.voiceLanguage);
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceDraft("");
      playSfx("voice_start");
    };

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalTranscript += ` ${transcript}`;
        } else {
          interim += ` ${transcript}`;
        }
      }

      setVoiceDraft(`${finalTranscript} ${interim}`.trim());
    };

    recognition.onerror = () => {
      setError("Voice capture failed. Try again.");
      playSfx("error");
    };

    recognition.onend = () => {
      setIsListening(false);
      playSfx("voice_stop");

      let normalized = finalTranscript.trim();
      setVoiceDraft("");

      if (!normalized) {
        return;
      }

      if (settings.preferences.wakeWordEnabled) {
        const match = normalized.match(/^hey\s+jarvis[,:]?\s*(.*)$/i);

        if (!match) {
          setError("Wake word mode is enabled. Start with 'Hey JARVIS'.");
          return;
        }

        normalized = match[1]?.trim();
      }

      if (!normalized) {
        return;
      }

      setInput((prev) => `${prev} ${normalized}`.trim());
    };

    recognition.start();
  }, [
    isListening,
    playSfx,
    settings.preferences.voiceLanguage,
    settings.preferences.wakeWordEnabled,
  ]);

  const uploadFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const prepared = await Promise.all(
      Array.from(files)
        .slice(0, 3)
        .map(async (file) => ({
          name: file.name,
          type: file.type || "text/plain",
          content: (await file.text()).slice(0, 6000),
        })),
    );

    setContextFiles((prev) => {
      const merged = [...prev, ...prepared];
      return merged.slice(0, 4);
    });
  }, []);

  const saveManualMemory = useCallback(async () => {
    const text = manualMemoryInput.trim();
    if (!text) {
      return;
    }

    const response = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, kind: "note", text, source: "manual" }),
    });

    if (response.ok) {
      setManualMemoryInput("");
      await refreshMemories();
      playSfx("success");
    } else {
      playSfx("error");
    }
  }, [manualMemoryInput, playSfx, refreshMemories, userId]);

  const removeMemory = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/memory/${id}?userId=${userId}`, { method: "DELETE" });
      await refreshMemories();
      playSfx(response.ok ? "success" : "error");
    },
    [playSfx, refreshMemories, userId],
  );

  const commitMemoryEdit = useCallback(async () => {
    if (!editingMemoryId) {
      return;
    }

    const response = await fetch(`/api/memory/${editingMemoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, text: editingMemoryText.trim() }),
    });

    setEditingMemoryId(null);
    setEditingMemoryText("");
    await refreshMemories();
    playSfx(response.ok ? "success" : "error");
  }, [editingMemoryId, editingMemoryText, playSfx, refreshMemories, userId]);

  const clearMemories = useCallback(async () => {
    const response = await fetch(`/api/memory?userId=${userId}`, { method: "DELETE" });
    await refreshMemories();
    playSfx(response.ok ? "success" : "error");
  }, [playSfx, refreshMemories, userId]);

  const createProductivityItem = useCallback(async () => {
    const title = newItemTitle.trim();
    if (!title) {
      return;
    }

    const response = await fetch("/api/productivity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        type: newItemType,
        title,
        dueAt: newReminderDate || undefined,
      }),
    });

    if (response.ok) {
      setNewItemTitle("");
      setNewReminderDate("");
      await refreshItems();
      playSfx("success");
    } else {
      playSfx("error");
    }
  }, [newItemTitle, newItemType, newReminderDate, playSfx, refreshItems, userId]);

  const toggleTaskDone = useCallback(
    async (item: ProductivityItem) => {
      const response = await fetch("/api/productivity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          id: item._id,
          completed: !item.completed,
        }),
      });

      await refreshItems();
      if (response.ok) {
        playSfx(item.completed ? "task_undo" : "task_done");
      } else {
        playSfx("error");
      }
    },
    [playSfx, refreshItems, userId],
  );

  const removeProductivityItem = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/productivity?userId=${userId}&id=${id}`, {
        method: "DELETE",
      });
      await refreshItems();
      playSfx(response.ok ? "success" : "error");
    },
    [playSfx, refreshItems, userId],
  );

  const exportData = useCallback(async () => {
    const response = await fetch(`/api/export?userId=${userId}`, { cache: "no-store" });
    if (!response.ok) {
      playSfx("error");
      return;
    }

    const payload = await response.json();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jarvis-export-${userId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    playSfx("success");
  }, [playSfx, userId]);

  const purgeAllData = useCallback(async () => {
    const shouldDelete = window.confirm(
      "Delete all memories, history, and productivity data for this profile?",
    );

    if (!shouldDelete) {
      return;
    }

    const response = await fetch(`/api/export?userId=${userId}`, { method: "DELETE" });
    setMessages([WELCOME_MESSAGE]);
    setMemories([]);
    setItems([]);
    playSfx(response.ok ? "success" : "error");
  }, [playSfx, userId]);

  const memoryInsights = useMemo(
    () => ({
      weakSubjects: memories.filter((memory) => memory.kind === "weak_subject").slice(0, 4),
      emotions: memories.filter((memory) => memory.kind === "emotion").slice(0, 3),
      patterns: memories.filter((memory) => memory.kind === "study_pattern").slice(0, 3),
    }),
    [memories],
  );

  const tasks = useMemo(() => items.filter((item) => item.type === "task"), [items]);
  const notes = useMemo(() => items.filter((item) => item.type === "note"), [items]);
  const reminders = useMemo(() => items.filter((item) => item.type === "reminder"), [items]);

  return (
    <div
      className={`relative min-h-screen bg-gradient-to-br ${classesForTheme(settings.preferences.theme)} text-slate-100`}
    >
      <div className="pointer-events-none absolute inset-0 hud-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(244,63,94,0.14),transparent_28%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1700px] gap-4 p-3 md:grid-cols-[280px_minmax(0,1fr)_340px] md:p-5">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          className="panel-glass flex min-h-[280px] flex-col gap-4 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-full border border-cyan-300/60 bg-cyan-500/15">
              <div className="absolute inset-2 rounded-full bg-cyan-300/70 blur-md" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.25em] text-cyan-200">JARVIS</div>
              <div className="text-xs text-slate-300/80">Adaptive Intelligence Core</div>
            </div>
          </div>

          <div className="grid gap-3 text-xs">
            <label className="space-y-1">
              <span className="panel-label">Agent</span>
              <select
                value={settings.agent}
                onChange={(event) => {
                  const next = event.target.value as AgentMode;
                  setSettings((prev) => ({ ...prev, agent: next }));
                  void patchSettings({ agent: next });
                }}
                className="hud-input"
              >
                {AGENT_OPTIONS.map((agent) => (
                  <option key={agent} value={agent}>
                    {formatModeLabel(agent)} AI
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="panel-label">Response Tone</span>
              <select
                value={settings.preferences.responseTone}
                onChange={(event) => {
                  const responseTone = event.target.value as UserSettings["preferences"]["responseTone"];
                  setSettings((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      responseTone,
                    },
                  }));
                  void patchSettings({ preferences: { responseTone } });
                }}
                className="hud-input"
              >
                {TONE_OPTIONS.map((tone) => (
                  <option key={tone} value={tone}>
                    {formatModeLabel(tone)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="panel-label">Training Mode</span>
              <select
                value={settings.training.mode}
                onChange={(event) => {
                  const mode = event.target.value as UserSettings["training"]["mode"];
                  setSettings((prev) => ({
                    ...prev,
                    training: {
                      ...prev.training,
                      mode,
                    },
                  }));
                  void patchSettings({ training: { mode } });
                }}
                className="hud-input"
              >
                {TRAINING_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {formatModeLabel(mode)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !settings.knowledgeMode;
                  setSettings((prev) => ({ ...prev, knowledgeMode: next }));
                  void patchSettings({ knowledgeMode: next });
                }}
                className={`hud-toggle ${settings.knowledgeMode ? "hud-toggle-active" : ""}`}
              >
                <Globe size={14} /> Knowledge
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !settings.training.autoLearning;
                  setSettings((prev) => ({
                    ...prev,
                    training: {
                      ...prev.training,
                      autoLearning: next,
                    },
                  }));
                  void patchSettings({ training: { autoLearning: next } });
                }}
                className={`hud-toggle ${settings.training.autoLearning ? "hud-toggle-active" : ""}`}
              >
                <BrainCircuit size={14} /> Auto Learn
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !settings.preferences.wakeWordEnabled;
                  setSettings((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      wakeWordEnabled: next,
                    },
                  }));
                  void patchSettings({ preferences: { wakeWordEnabled: next } });
                }}
                className={`hud-toggle ${settings.preferences.wakeWordEnabled ? "hud-toggle-active" : ""}`}
              >
                <Bell size={14} /> Wake Word
              </button>
              <button
                type="button"
                onClick={() => setVoiceOutput((prev) => !prev)}
                className={`hud-toggle ${voiceOutput ? "hud-toggle-active" : ""}`}
              >
                <Activity size={14} /> Voice Out
              </button>
              <button
                type="button"
                onClick={() => setSoundEffectsEnabled((prev) => !prev)}
                className={`hud-toggle ${soundEffectsEnabled ? "hud-toggle-active" : ""}`}
              >
                {soundEffectsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />} SFX
              </button>
            </div>

            <div className="space-y-1">
              <div className="panel-label">Voice Language</div>
              <select
                value={settings.preferences.voiceLanguage}
                onChange={(event) => {
                  const voiceLanguage = event.target
                    .value as UserSettings["preferences"]["voiceLanguage"];
                  setSettings((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      voiceLanguage,
                    },
                  }));
                  void patchSettings({ preferences: { voiceLanguage } });
                }}
                className="hud-input"
              >
                {VOICE_LANGUAGE_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === "bilingual"
                      ? "English + Hindi"
                      : mode === "en"
                        ? "English"
                        : "Hindi"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="panel-label">Voice Gender</div>
              <select
                value={settings.preferences.voiceGender}
                onChange={(event) => {
                  const voiceGender = event.target
                    .value as UserSettings["preferences"]["voiceGender"];
                  setSettings((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      voiceGender,
                    },
                  }));
                  void patchSettings({ preferences: { voiceGender } });
                }}
                className="hud-input"
              >
                {VOICE_GENDER_OPTIONS.map((voiceGender) => (
                  <option key={voiceGender} value={voiceGender}>
                    {voiceGender === "auto" ? "Auto" : formatModeLabel(voiceGender)}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-slate-300/70">
                Active voice: {activeVoiceLabel}
              </div>
            </div>

            <div className="space-y-2">
              <div className="panel-label">Theme</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`hud-toggle ${settings.preferences.theme === "jarvis" ? "hud-toggle-active" : ""}`}
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, theme: "jarvis" },
                    }));
                    void patchSettings({ preferences: { theme: "jarvis" } });
                  }}
                >
                  <Sparkles size={14} /> JARVIS
                </button>
                <button
                  type="button"
                  className={`hud-toggle ${settings.preferences.theme === "friday" ? "hud-toggle-active" : ""}`}
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, theme: "friday" },
                    }));
                    void patchSettings({ preferences: { theme: "friday" } });
                  }}
                >
                  <Flame size={14} /> FRIDAY
                </button>
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-2 text-xs text-slate-300/80">
            <div className="panel-label">Keyboard Shortcuts</div>
            <div>`Ctrl/Cmd + K` focus input</div>
            <div>`Ctrl/Cmd + Enter` send</div>
            <div>`Alt + V` voice capture</div>
            <div>`Alt + M` memory panel</div>
          </div>
        </motion.aside>

        <motion.main
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-glass flex min-h-[420px] flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <Bot size={18} className="text-cyan-300" />
              <div>
                <div className="text-sm font-semibold tracking-[0.2em] text-cyan-200">
                  Conversational Core
                </div>
                <div className="text-xs text-slate-300/80">
                  {settings.agent.toUpperCase()} agent | {settings.training.mode.toUpperCase()} mode
                </div>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-300/70 md:flex">
              <Settings2 size={14} />
              {loading ? "Syncing systems..." : "Systems synchronized"}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 md:px-5">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <MessageBubble
                    message={message}
                    streaming={streamingMessageId === message.id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {sending ? <TypingIndicator /> : null}
            {voiceDraft ? (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                Voice draft: {voiceDraft}
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <div className="space-y-3 border-t border-white/10 p-3 md:p-4">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setInput(action.command);
                      textAreaRef.current?.focus();
                    }}
                  >
                    <Icon size={13} /> {action.label}
                  </button>
                );
              })}
            </div>

            {contextFiles.length ? (
              <div className="flex flex-wrap gap-2">
                {contextFiles.map((file) => (
                  <span key={file.name} className="chip">
                    <NotebookPen size={13} /> {file.name}
                    <button
                      type="button"
                      onClick={() =>
                        setContextFiles((prev) =>
                          prev.filter((entry) => entry.name !== file.name),
                        )
                      }
                      className="rounded-full p-0.5 hover:bg-white/10"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <textarea
                ref={textAreaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                placeholder="Ask, command, code, summarize, or upload context..."
                className="hud-textarea"
              />

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="hud-icon-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload files"
                >
                  <Upload size={16} />
                </button>
                <button
                  type="button"
                  className={`hud-icon-btn ${isListening ? "!text-rose-300" : ""}`}
                  onClick={() => void toggleVoiceInput()}
                  disabled={!isVoiceSupported}
                  title={
                    isVoiceSupported
                      ? "Toggle speech input"
                      : "Speech input not supported"
                  }
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button
                  type="button"
                  className="hud-icon-btn"
                  onClick={() => void sendMessage()}
                  disabled={sending}
                  title="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            <VoiceWaveform active={isListening} />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".txt,.md,.json,.js,.ts,.tsx,.py,.java,.cpp,.c,.h,.csv"
              onChange={(event) => void uploadFiles(event.target.files)}
            />
          </div>
        </motion.main>

        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          className="panel-glass flex min-h-[280px] flex-col gap-4 overflow-hidden p-4"
        >
          <div className="grid gap-3">
            <div className="panel-card">
              <div className="panel-title">
                <ClockWidget now={now} />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300/85">
                <span className="inline-flex items-center gap-1">
                  <Cloud size={14} className="text-cyan-300" />
                  {weather.location || "Locating"}
                </span>
                <span>
                  {weather.temperatureC !== undefined
                    ? `${Math.round(weather.temperatureC)}°C`
                    : "--"} {weather.condition}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <Metric label="Cores" value={systemStats.cores ?? "--"} icon={Cpu} />
                <Metric
                  label="Memory"
                  value={
                    systemStats.memoryGB !== undefined
                      ? `${systemStats.memoryGB} GB`
                      : "--"
                  }
                  icon={Activity}
                />
                <Metric
                  label="Net"
                  value={systemStats.networkType ?? "--"}
                  icon={Wifi}
                />
              </div>
            </div>

            <div className="panel-card" ref={memoryPanelRef}>
              <div className="flex items-center justify-between">
                <div className="panel-title">Memory & Training</div>
                <button
                  type="button"
                  onClick={() => void clearMemories()}
                  className="hud-inline-btn"
                  title="Clear memories"
                >
                  <Eraser size={13} /> Clear
                </button>
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  value={manualMemoryInput}
                  onChange={(event) => setManualMemoryInput(event.target.value)}
                  placeholder="/remember style note"
                  className="hud-input"
                />
                <button
                  type="button"
                  className="hud-icon-btn"
                  onClick={() => void saveManualMemory()}
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="mt-2 max-h-52 space-y-2 overflow-auto pr-1">
                {memories.slice(0, 12).map((memory) => (
                  <div key={memory._id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                    {editingMemoryId === memory._id ? (
                      <div className="space-y-2">
                        <input
                          value={editingMemoryText}
                          onChange={(event) => setEditingMemoryText(event.target.value)}
                          className="hud-input"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="hud-inline-btn"
                            onClick={() => void commitMemoryEdit()}
                          >
                            <Check size={13} /> Save
                          </button>
                          <button
                            type="button"
                            className="hud-inline-btn"
                            onClick={() => {
                              setEditingMemoryId(null);
                              setEditingMemoryText("");
                            }}
                          >
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-slate-100">{memory.text}</div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-300/75">
                          <span>{memory.kind.replace(/_/g, " ")}</span>
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              className="hud-inline-btn"
                              onClick={() => {
                                setEditingMemoryId(memory._id);
                                setEditingMemoryText(memory.text);
                              }}
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              type="button"
                              className="hud-inline-btn"
                              onClick={() => void removeMemory(memory._id)}
                            >
                              <Trash2 size={11} />
                            </button>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {!memories.length ? (
                  <div className="text-xs text-slate-300/70">No memories stored yet.</div>
                ) : null}
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-title">Productivity Core</div>

              <div className="mt-2 flex gap-2">
                <select
                  value={newItemType}
                  onChange={(event) => setNewItemType(event.target.value as ProductivityType)}
                  className="hud-input"
                >
                  <option value="task">Task</option>
                  <option value="note">Note</option>
                  <option value="reminder">Reminder</option>
                </select>
                <input
                  value={newItemTitle}
                  onChange={(event) => setNewItemTitle(event.target.value)}
                  placeholder="Add item"
                  className="hud-input"
                />
              </div>

              {newItemType === "reminder" ? (
                <input
                  type="datetime-local"
                  value={newReminderDate}
                  onChange={(event) => setNewReminderDate(event.target.value)}
                  className="mt-2 hud-input"
                />
              ) : null}

              <button
                type="button"
                className="mt-2 hud-inline-btn"
                onClick={() => void createProductivityItem()}
              >
                <Plus size={13} /> Add
              </button>

              <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1 text-xs">
                {tasks.slice(0, 4).map((task) => (
                  <ProductivityRow
                    key={task._id}
                    item={task}
                    onToggle={() => void toggleTaskDone(task)}
                    onDelete={() => void removeProductivityItem(task._id)}
                  />
                ))}
                {notes.slice(0, 2).map((note) => (
                  <ProductivityRow
                    key={note._id}
                    item={note}
                    onDelete={() => void removeProductivityItem(note._id)}
                  />
                ))}
                {reminders.slice(0, 3).map((reminder) => (
                  <ProductivityRow
                    key={reminder._id}
                    item={reminder}
                    onDelete={() => void removeProductivityItem(reminder._id)}
                  />
                ))}
                {!items.length ? (
                  <div className="text-slate-300/70">No tasks, notes, or reminders yet.</div>
                ) : null}
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-title">AI Insights</div>
              <InsightList title="Weak Subjects" values={memoryInsights.weakSubjects.map((item) => item.value || item.text)} icon={GraduationCap} />
              <InsightList title="Emotion Signals" values={memoryInsights.emotions.map((item) => item.value || item.text)} icon={Flame} />
              <InsightList title="Study Patterns" values={memoryInsights.patterns.map((item) => item.value || item.text)} icon={BrainCircuit} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="hud-toggle" onClick={() => void exportData()}>
                <Download size={14} /> Export
              </button>
              <button type="button" className="hud-toggle" onClick={() => void purgeAllData()}>
                <Trash2 size={14} /> Delete All
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2 text-xs text-rose-100">
              {error}
            </div>
          ) : null}
        </motion.aside>
      </div>
    </div>
  );
}

function ClockWidget({ now }: { now: Date | null }) {
  const clockValue = now
    ? now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "--:--:--";

  const dateValue = now
    ? now.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "--- --";

  return (
    <div className="flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-cyan-200">
        <Activity size={15} />
        <span className="text-sm font-semibold tracking-[0.16em]">Live Dashboard</span>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold text-slate-100">{clockValue}</div>
        <div className="text-[11px] text-slate-300/75">{dateValue}</div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Cpu;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
      <div className="mx-auto mb-1 inline-flex text-cyan-300">
        <Icon size={13} />
      </div>
      <div className="text-[10px] text-slate-300/70">{label}</div>
      <div className="text-xs text-slate-100">{value}</div>
    </div>
  );
}

function ProductivityRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ProductivityItem;
  onToggle?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-slate-100">
            {item.completed ? <span className="line-through opacity-70">{item.title}</span> : item.title}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
            {item.type}
            {item.dueAt
              ? ` • due ${formatDistanceToNow(new Date(item.dueAt), { addSuffix: true })}`
              : ""}
          </div>
        </div>
        <div className="flex gap-1">
          {onToggle ? (
            <button type="button" className="hud-inline-btn" onClick={onToggle}>
              <Check size={11} />
            </button>
          ) : null}
          <button type="button" className="hud-inline-btn" onClick={onDelete}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function InsightList({
  title,
  values,
  icon: Icon,
}: {
  title: string;
  values: string[];
  icon: typeof Sparkles;
}) {
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
      <div className="mb-1 inline-flex items-center gap-1 text-cyan-200">
        <Icon size={13} /> {title}
      </div>
      {values.length ? (
        <div className="space-y-1 text-slate-200/90">
          {values.slice(0, 3).map((value) => (
            <div key={value}>• {value}</div>
          ))}
        </div>
      ) : (
        <div className="text-slate-400">No signals yet.</div>
      )}
    </div>
  );
}
