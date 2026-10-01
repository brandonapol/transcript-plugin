export type Cue = { start: number; end: number; text: string };

export type Chapter = { start: number; title: string };

export type ClipKind =
  | "story"
  | "contrarian"
  | "howto"
  | "confession"
  | "stat"
  | "quote";

export type Clip = {
  start: number;
  end: number;
  hook: string;
  title: string;
  why: string;
  kind: ClipKind;
  excerpt: string;
  score: number;
};

export type PullInput = {
  url: string;
  transcript: string;
  targetSeconds: number;
  count: number;
};

export type PullOk = {
  ok: true;
  title: string;
  author: string;
  duration: number;
  videoId: string | null;
  approximate: boolean;
  engine: "grok" | "bench";
  note: string;
  cues: Cue[];
  clips: Clip[];
  chapters: Chapter[];
};

export type PullResult = PullOk | { ok: false; error: string };

const KINDS: ClipKind[] = [
  "story",
  "contrarian",
  "howto",
  "confession",
  "stat",
  "quote",
];

const AD =
  /\b(sponsor|sponsored|brought to you|promo code|like and subscribe|link in the description|patreon|use code|welcome back|thanks for listening|smash that|we'll be back)\b/i;

export function youtubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) =>
      ["embed", "shorts", "live", "v"].includes(part),
    );
    const id = marker >= 0 ? (parts[marker + 1] ?? "") : "";
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  return null;
}

export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function normalizeInput(data: unknown): PullInput {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const target = Number(record.targetSeconds ?? 45);
  const count = Number(record.count ?? 6);
  return {
    url: typeof record.url === "string" ? record.url.trim().slice(0, 500) : "",
    transcript:
      typeof record.transcript === "string"
        ? record.transcript.slice(0, 200_000)
        : "",
    targetSeconds: Number.isFinite(target)
      ? Math.min(120, Math.max(15, Math.round(target)))
      : 45,
    count: Number.isFinite(count)
      ? Math.min(8, Math.max(3, Math.round(count)))
      : 6,
  };
}

function decodeEntities(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/"/g, '"')
    .replace(/'|&#39;/g, "'")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function clockToSeconds(clock: string): number {
  const clean = clock.trim().replace(",", ".");
  const parts = clean.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0] ?? 0;
}

function pushCue(cues: Cue[], start: number, end: number, text: string) {
  const spoken = text
    .replace(/[♪♫]/g, " ")
    .replace(/\[(?:music|applause|laughter|silence)\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spoken) return;
  const safeEnd = Math.max(end, start + 0.4);
  const previous = cues[cues.length - 1];
  const gap = previous ? start - previous.end : 99;
  const previousSpan = previous ? previous.end - previous.start : 99;
  if (
    previous &&
    gap < 0.35 &&
    previousSpan < 1.6 &&
    previous.text.length < 180
  ) {
    previous.end = safeEnd;
    previous.text = `${previous.text} ${spoken}`.replace(/\s+/g, " ").trim();
    return;
  }
  cues.push({ start, end: safeEnd, text: spoken });
}

function parseTimedBlocks(source: string): Cue[] {
  const cues: Cue[] = [];
  const pattern =
    /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/g;
  const matches = [...source.matchAll(pattern)];
  matches.forEach((match, index) => {
    const start = clockToSeconds(match[0].split("-->")[0] ?? "0");
    const end = clockToSeconds(match[1] ?? "0");
    const from = (match.index ?? 0) + match[0].length;
    const to = matches[index + 1]?.index ?? source.length;
    const text = decodeEntities(source.slice(from, to).replace(/^\d+\s*$/gm, " "));
    pushCue(cues, start, end, text);
  });
  return cues;
}

function parseTtml(source: string): Cue[] {
  const cues: Cue[] = [];
  const pattern =
    /begin="([^"]+)"[^>]*end="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of source.matchAll(pattern)) {
    pushCue(
      cues,
      clockToSeconds(match[1] ?? "0"),
      clockToSeconds(match[2] ?? "0"),
      decodeEntities(match[3] ?? ""),
    );
  }
  return cues;
}

function parseTimestampLines(source: string): Cue[] {
  const cues: Cue[] = [];
  const lines = source.split(/\r?\n/);
  const linePattern =
    /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\]?\s*(?:[-–—]\s*)?(.+?)\s*$/;
  lines.forEach((line, index) => {
    const match = line.match(linePattern);
    if (!match?.[2]) return;
    const start = clockToSeconds(match[1] ?? "0");
    const next = lines
      .slice(index + 1)
      .map((candidate) => candidate.match(linePattern)?.[1])
      .find(Boolean);
    const end = next ? clockToSeconds(next) : start + 4;
    pushCue(cues, start, end, match[2]);
  });
  return cues;
}

function parsePlain(source: string): Cue[] {
  const sentences = source
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 1);
  const cues: Cue[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).length;
    const dur = Math.min(12, Math.max(2.5, words * 0.42));
    pushCue(cues, cursor, cursor + dur, sentence);
    cursor += dur;
  }
  return cues;
}

export function parseTranscript(source: string): {
  cues: Cue[];
  approximate: boolean;
} {
  const trimmed = source.trim();
  if (!trimmed) return { cues: [], approximate: false };
  if (/<tt[\s>]|<p\s+begin=/i.test(trimmed)) {
    const cues = parseTtml(trimmed);
    if (cues.length) return { cues, approximate: false };
  }
  if (trimmed.includes("-->")) {
    const cues = parseTimedBlocks(trimmed);
    if (cues.length) return { cues, approximate: false };
  }
  const lined = parseTimestampLines(trimmed);
  if (lined.length >= 2 || (lined.length === 1 && lined[0]!.text.length > 0)) {
    const timedLines = trimmed
      .split(/\r?\n/)
      .filter((line) =>
        /^\s*\[?(?:\d{1,2}:)?\d{1,2}:\d{2}/.test(line),
      ).length;
    if (timedLines >= Math.min(2, lined.length)) {
      return { cues: lined, approximate: false };
    }
  }
  return { cues: parsePlain(trimmed), approximate: true };
}

function kindFor(text: string): ClipKind {
  if (/\b(i was wrong|i failed|i quit|i didn't|we almost)\b/i.test(text)) {
    return "confession";
  }
  if (/\b(unpopular|everyone thinks|the opposite|myth|wrong about|nobody)\b/i.test(text)) {
    return "contrarian";
  }
  if (/\b(here's how|here is how|the way you|step one|do this|first,)\b/i.test(text)) {
    return "howto";
  }
  if (/\b\d[\d,.]*\s*%?|\b(percent|million|billion)\b|\$\s?\d/i.test(text)) {
    return "stat";
  }
  if (/\b(when i|years ago|one day|the night|remember|died|opened)\b/i.test(text)) {
    return "story";
  }
  return "quote";
}

function whyFor(kind: ClipKind): string {
  switch (kind) {
    case "confession":
      return "A personal turn lands harder than a summary of the episode.";
    case "contrarian":
      return "It picks a fight in the first line, so the scroll stops.";
    case "howto":
      return "Someone can steal the move without watching the whole tape.";
    case "stat":
      return "A concrete number gives the cut a thumbnail and a title.";
    case "story":
      return "It opens in the middle of a scene, not on the intro.";
    default:
      return "The line can stand alone on a silent screen.";
  }
}

export function hookLine(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  const words = sentence.split(/\s+/);
  if (words.length <= 14) return sentence;
  return `${words.slice(0, 14).join(" ").replace(/[,:;]$/, "")}…`;
}

function titleFor(hook: string, kind: ClipKind): string {
  const words = hook
    .replace(/[^\w\s'$]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);
  if (words.length >= 3) {
    return words.join(" ");
  }
  return kind === "stat" ? "The number that matters" : "The line to open on";
}

function scoreWindow(text: string, start: number, end: number, target: number): number {
  let score = 0;
  const opening = text.slice(0, 180);
  if (AD.test(text)) score -= 7;
  if (/\?/.test(opening)) score += 2.2;
  if (
    /^(so |look,|here'?s |the truth|the thing|what nobody|nobody |i was |we lost|we almost|the moment|let me |this is the|if you |don'?t |stop |wait[, ])/i.test(
      opening,
    )
  ) {
    score += 2.4;
  }
  if (/\b(never|always|worst|best|only|secret|mistake|died|wrong)\b/i.test(text)) {
    score += 1.3;
  }
  const numbers = text.match(/\b\d[\d,.]*\b/g);
  if (numbers) score += Math.min(2.4, numbers.length * 0.8);
  const duration = Math.max(0.1, end - start);
  const closeness = 1 - Math.min(1, Math.abs(duration - target) / target);
  score += closeness * 1.5;
  const words = text.split(/\s+/).length;
  if (words < 16) score -= 2;
  if (words > 180) score -= 1;
  if (/[.!?]["']?$/.test(text)) score += 0.4;
  return score;
}

function buildWindows(cues: Cue[], target: number): Clip[] {
  const windows: Clip[] = [];
  const maxDur = target * 1.25;
  for (let i = 0; i < cues.length; i += 1) {
    let text = "";
    let end = cues[i]!.start;
    const start = cues[i]!.start;
    for (let j = i; j < cues.length; j += 1) {
      const cue = cues[j]!;
      if (j > i && cue.start - end > 1.2) break;
      if (j > i && AD.test(cue.text) && end - start >= 8) break;
      text = text ? `${text} ${cue.text}` : cue.text;
      end = cue.end;
      if (end - start >= maxDur) break;
    }
    if (end - start < 8 && cues.length > 2) continue;
    if (AD.test(text.slice(0, 90))) continue;
    const excerpt = text.replace(/\s+/g, " ").trim();
    if (!excerpt) continue;
    const kind = kindFor(excerpt);
    const hook = hookLine(excerpt);
    windows.push({
      start,
      end,
      hook,
      title: titleFor(hook, kind),
      why: whyFor(kind),
      kind,
      excerpt,
      score: scoreWindow(excerpt, start, end, target),
    });
  }
  return windows;
}

export function rankClips(cues: Cue[], targetSeconds: number, count: number): Clip[] {
  const target = Math.min(120, Math.max(15, targetSeconds));
  const wanted = Math.min(8, Math.max(1, count));
  const ranked = buildWindows(cues, target).sort((a, b) => b.score - a.score);
  const chosen: Clip[] = [];
  for (const clip of ranked) {
    if (clip.score < 0.5) continue;
    const overlapIndex = chosen.findIndex(
      (kept) => clip.start < kept.end - 1 && kept.start < clip.end - 1,
    );
    if (overlapIndex === -1) {
      if (chosen.length < wanted) chosen.push(clip);
      continue;
    }
    const kept = chosen[overlapIndex]!;
    const coversKept = clip.start <= kept.start && clip.end >= kept.end - 1;
    if (coversKept && clip.score >= kept.score - 1.25) {
      chosen[overlapIndex] = clip;
    }
  }
  return chosen;
}

export function excerptBetween(cues: Cue[], start: number, end: number): string {
  return cues
    .filter((cue) => cue.end > start + 0.05 && cue.start < end - 0.05)
    .map((cue) => cue.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function asKind(value: unknown): ClipKind {
  return KINDS.includes(value as ClipKind) ? (value as ClipKind) : "quote";
}

export function wordCount(cues: Cue[]): number {
  return cues.reduce((sum, cue) => sum + cue.text.split(/\s+/).length, 0);
}
