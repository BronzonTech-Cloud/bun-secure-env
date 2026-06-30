/**
 * Unescapes double-quoted string escape sequences.
 * @param val The string content inside double quotes
 * @returns The unescaped string
 */
function unescapeDoubleQuoted(val: string): string {
  return val
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Unescapes single-quoted string escape sequences.
 * @param val The string content inside single quotes
 * @returns The unescaped string
 */
function unescapeSingleQuoted(val: string): string {
  return val.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

/**
 * Parses unquoted value parts, stripping inline comments.
 * @param valPart The raw value string
 * @returns The trimmed and comment-stripped value
 */
function parseUnquoted(valPart: string): string {
  const commentIdx = valPart.search(/\s#/);
  if (commentIdx !== -1) {
    return valPart.slice(0, commentIdx).trim();
  }
  if (valPart.startsWith("#")) {
    return "";
  }
  return valPart.trim();
}

/**
 * Parses the value part of a key-value pair, handling quotes and comments.
 * @param valPart The raw value string
 * @returns The parsed value
 */
function parseValue(valPart: string): string {
  if (valPart.startsWith('"')) {
    const match = valPart.match(/^"([^"\\]*(?:\\.[^"\\]*)*)"/);
    return match ? unescapeDoubleQuoted(match[1] ?? "") : parseUnquoted(valPart);
  }
  if (valPart.startsWith("'")) {
    const match = valPart.match(/^'([^'\\]*(?:\\.[^'\\]*)*)'/);
    return match ? unescapeSingleQuoted(match[1] ?? "") : parseUnquoted(valPart);
  }
  return parseUnquoted(valPart);
}

/**
 * Parses a plaintext .env file content into a key-value Record.
 * @param text The plaintext .env file content
 * @returns A record of environment variable keys and values
 */
export function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    if (key === "") {
      continue;
    }

    const valPart = line.slice(eqIdx + 1).trim();
    result[key] = parseValue(valPart);
  }

  return result;
}
