import { formatTimecode, type PullOk } from "./cues.ts";

export function cutListMarkdown(result: PullOk): string {
  const lines = [`# ${result.title}`, ""];
  if (result.author) lines.push(result.author, "");
  result.clips.forEach((clip, index) => {
    lines.push(
      `## ${index + 1}. ${clip.hook}`,
      "",
      `${formatTimecode(clip.start)}–${formatTimecode(clip.end)} · ${clip.kind}`,
      clip.why,
      "",
      `> ${clip.excerpt}`,
      "",
    );
  });
  return lines.join("\n").trim();
}
