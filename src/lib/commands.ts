export type ParsedCommand =
  | {
      type: "remember";
      text: string;
    }
  | {
      type: "forget";
      text: string;
    }
  | {
      type: "update";
      field: string;
      value: string;
    }
  | {
      type: "clear_memory";
    }
  | {
      type: "summarize";
      text: string;
    }
  | {
      type: "help";
    };

export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  if (trimmed.startsWith("/remember ")) {
    return {
      type: "remember",
      text: trimmed.replace(/^\/remember\s+/i, "").trim(),
    };
  }

  if (trimmed.startsWith("/forget ")) {
    return {
      type: "forget",
      text: trimmed.replace(/^\/forget\s+/i, "").trim(),
    };
  }

  if (trimmed.startsWith("/update ")) {
    const rest = trimmed.replace(/^\/update\s+/i, "").trim();
    const assignment = rest.match(/^([^:=]+)\s*[:=]\s*(.+)$/);

    if (assignment) {
      return {
        type: "update",
        field: assignment[1].trim().toLowerCase().replace(/\s+/g, "_"),
        value: assignment[2].trim(),
      };
    }

    const [field, ...valueParts] = rest.split(" ");
    return {
      type: "update",
      field: field.trim().toLowerCase().replace(/\s+/g, "_"),
      value: valueParts.join(" ").trim(),
    };
  }

  if (/^\/clear\s+memory$/i.test(trimmed)) {
    return { type: "clear_memory" };
  }

  if (trimmed.startsWith("/summarize ")) {
    return {
      type: "summarize",
      text: trimmed.replace(/^\/summarize\s+/i, "").trim(),
    };
  }

  if (/^\/(help|commands)$/i.test(trimmed)) {
    return { type: "help" };
  }

  return null;
}

export function commandHelpMessage() {
  return [
    "Available command mode operations:",
    "- /remember <text>",
    "- /forget <text>",
    "- /update <field>: <value>",
    "- /clear memory",
    "- /summarize <text>",
    "- /help",
  ].join("\n");
}
