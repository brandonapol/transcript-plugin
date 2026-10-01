import { useState, type FormEvent } from "react";
import { Check, Copy, Play, Scissors } from "lucide-react";
import {
  formatTimecode,
  type Clip,
  type PullOk,
} from "@/lib/cues";
import { cutListMarkdown } from "@/lib/cut-list";
import { pullHooks } from "@/lib/pull.functions";
import { samplePull } from "@/lib/sample";

const LENGTHS = [20, 35, 45, 75] as const;
const COUNTS = [4, 6, 8] as const;

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-11 rounded-full px-4 text-sm ${
        pressed
          ? "bg-ink text-bay-fg"
          : "bg-sheet text-ink shadow-sheet"
      }`}
    >
      {children}
    </button>
  );
}

export function Bench() {
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [targetSeconds, setTargetSeconds] = useState<(typeof LENGTHS)[number]>(45);
  const [count, setCount] = useState<(typeof COUNTS)[number]>(6);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sample, setSample] = useState(true);
  const [result, setResult] = useState<PullOk>(() => samplePull());
  const [active, setActive] = useState(0);
  const [playAt, setPlayAt] = useState<number | null>(null);
  const [copied, setCopied] = useState("");

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? "" : current)), 1600);
    } catch {
      setError("Clipboard is blocked in this view. Select the hook and copy it yourself.");
    }
  }

  async function onPull(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const next = await pullHooks({
        data: { url, transcript, targetSeconds, count },
      });
      if (!next.ok) {
        setError(next.error);
        return;
      }
      setResult(next);
      setSample(false);
      setActive(0);
      setPlayAt(next.videoId ? next.clips[0]?.start ?? 0 : null);
    } catch {
      setError("That pull didn't finish. Check the link, or paste the transcript.");
    } finally {
      setPending(false);
    }
  }

  function loadSample() {
    setResult(samplePull());
    setSample(true);
    setError("");
    setActive(0);
    setPlayAt(null);
  }

  const clip = result.clips[active] ?? result.clips[0];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="bg-bay text-bay-fg">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest text-bay-muted uppercase">
              Cut desk
            </p>
            <h1 className="mt-2 font-serif text-5xl leading-none font-medium">
              Hookbench
            </h1>
          </div>
          <p className="max-w-sm text-sm leading-6 text-bay-muted">
            Paste a video you already have. Leave with in-points, out-points,
            and the line that stops the scroll.
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <form onSubmit={onPull} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm font-medium">
            YouTube link
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              inputMode="url"
              className="h-12 rounded-2xl border border-line bg-sheet px-4 text-base font-normal text-ink outline-none placeholder:text-faint focus-visible:border-hook"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Clip length</span>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((length) => (
                <Chip
                  key={length}
                  pressed={targetSeconds === length}
                  onClick={() => setTargetSeconds(length)}
                >
                  {`${length}s`}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">How many</span>
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((amount) => (
                <Chip
                  key={amount}
                  pressed={count === amount}
                  onClick={() => setCount(amount)}
                >
                  {String(amount)}
                </Chip>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPasteOpen((open) => !open)}
            className="self-start text-sm text-tape underline decoration-line underline-offset-4"
          >
            {pasteOpen ? "Hide transcript paste" : "No captions? Paste a transcript"}
          </button>

          {pasteOpen ? (
            <label className="flex flex-col gap-2 text-sm font-medium">
              SRT, VTT, or timestamped lines
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                rows={7}
                placeholder={"12:04 The oven died on a Friday\n12:18 We still opened Saturday"}
                className="rounded-2xl border border-line bg-sheet px-4 py-3 text-base leading-6 font-normal text-ink outline-none placeholder:text-faint focus-visible:border-hook"
              />
            </label>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-hook px-5 text-base font-medium text-bay-fg disabled:opacity-60"
          >
            <Scissors className="size-4" aria-hidden="true" />
            {pending ? "Reading the tape…" : "Pull hooks"}
          </button>
          <button
            type="button"
            onClick={loadSample}
            className="h-11 text-sm text-muted"
          >
            Put the sample cut back on the bench
          </button>
          {error ? (
            <p role="alert" className="text-sm leading-6 text-hook">
              {error}
            </p>
          ) : null}
        </form>

        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-widest text-tape uppercase">
                {sample
                  ? "Sample cut"
                  : result.engine === "grok"
                    ? "Marked by Grok"
                    : "Marked on the bench"}
              </p>
              <h2 className="mt-1 font-serif text-3xl leading-tight font-medium">
                {result.title}
              </h2>
              {result.author ? (
                <p className="mt-1 text-sm text-muted">{result.author}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => copy("list", cutListMarkdown(result))}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-sheet px-4 text-sm shadow-sheet"
            >
              {copied === "list" ? (
                <Check className="size-4 text-tape" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              {copied === "list" ? "Copied" : "Copy cut list"}
            </button>
          </div>
          {result.note ? (
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{result.note}</p>
          ) : null}

          {result.videoId ? (
            <iframe
              key={playAt ?? 0}
              title={result.title}
              src={`https://www.youtube-nocookie.com/embed/${result.videoId}?start=${Math.floor(playAt ?? 0)}${playAt != null ? "&autoplay=1" : ""}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="mt-5 aspect-video w-full rounded-2xl border border-line bg-bay"
            />
          ) : null}

          <ol className="mt-5 flex flex-col gap-3">
            {result.clips.map((item, index) => (
              <ClipCard
                key={`${item.start}-${item.hook}`}
                clip={item}
                index={index}
                selected={index === active}
                canPlay={Boolean(result.videoId)}
                copied={copied}
                onPlay={() => {
                  setActive(index);
                  setPlayAt(item.start);
                }}
                onCopy={(key, value) => copy(key, value)}
              />
            ))}
          </ol>

          <details className="mt-6 rounded-2xl border border-line bg-sheet">
            <summary className="px-4 py-3 text-sm font-medium">
              Transcript with marks
            </summary>
            <ol className="max-h-96 overflow-auto border-t border-line px-2 py-2">
              {result.cues.map((cue) => {
                const marked = clip
                  ? cue.end > clip.start && cue.start < clip.end
                  : false;
                return (
                  <li key={`${cue.start}-${cue.text.slice(0, 24)}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!result.videoId) return;
                        setPlayAt(cue.start);
                      }}
                      className={`flex w-full gap-3 rounded-xl px-2 py-2 text-left ${
                        marked ? "bg-hook-soft" : ""
                      }`}
                    >
                      <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-tape">
                        {formatTimecode(cue.start)}
                      </span>
                      <span className="min-w-0 text-sm leading-6">{cue.text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </details>
        </section>
      </main>
    </div>
  );
}

function ClipCard({
  clip,
  index,
  selected,
  canPlay,
  copied,
  onPlay,
  onCopy,
}: {
  clip: Clip;
  index: number;
  selected: boolean;
  canPlay: boolean;
  copied: string;
  onPlay: () => void;
  onCopy: (key: string, value: string) => void;
}) {
  const range = `${formatTimecode(clip.start)}–${formatTimecode(clip.end)}`;
  const span = Math.max(1, Math.round(clip.end - clip.start));
  const hookKey = `hook-${index}`;
  const timeKey = `time-${index}`;
  return (
    <li
      className={`rounded-2xl border bg-sheet p-4 shadow-sheet ${
        selected ? "border-hook" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-3xl tabular-nums text-hook">{range}</p>
        <p className="text-xs font-medium tracking-widest text-tape uppercase">
          {clip.kind} · {span}s
        </p>
      </div>
      <h3 className="mt-3 font-serif text-2xl leading-snug font-medium">
        {clip.hook}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">{clip.why}</p>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink">{clip.excerpt}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canPlay ? (
          <button
            type="button"
            onClick={onPlay}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm text-bay-fg"
          >
            <Play className="size-4" aria-hidden="true" />
            Play from here
          </button>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className="inline-flex h-11 items-center rounded-full bg-ink px-4 text-sm text-bay-fg"
          >
            Hold this cut
          </button>
        )}
        <button
          type="button"
          onClick={() => onCopy(timeKey, range)}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 text-sm"
        >
          {copied === timeKey ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied === timeKey ? "Copied" : "Copy time"}
        </button>
        <button
          type="button"
          onClick={() => onCopy(hookKey, clip.hook)}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 text-sm"
        >
          {copied === hookKey ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied === hookKey ? "Copied" : "Copy hook"}
        </button>
      </div>
    </li>
  );
}
