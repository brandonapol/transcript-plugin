import {
  rankClips,
  type PullOk,
} from "./cues.ts";

const cues = [
  {
    start: 0,
    end: 8,
    text: "Welcome back to Night Oven. I'm Mara, and this is the show.",
  },
  {
    start: 8,
    end: 16,
    text: "Today's guest almost lost the bakery last winter.",
  },
  {
    start: 16,
    end: 28,
    text: "This episode is sponsored by Northline flour. Use code OVEN at checkout.",
  },
  {
    start: 32,
    end: 48,
    text: "The oven died on a Friday and we still opened Saturday.",
  },
  {
    start: 48,
    end: 64,
    text: "We had 400 orders on the board and one skillet that could take two pans.",
  },
  {
    start: 64,
    end: 82,
    text: "I was wrong about the landlord. He showed up at 5 a.m. with sheet pans from his mother's house.",
  },
  {
    start: 86,
    end: 104,
    text: "Here's the part nobody puts in the founder story. We were too embarrassed to text the customers and cancel.",
  },
  {
    start: 104,
    end: 120,
    text: "We made $312 that day and it felt louder than any year we'd had before.",
  },
  {
    start: 124,
    end: 140,
    text: "If you only remember one thing, write the failure down while it is still hot. Cold stories get polite and useless.",
  },
  {
    start: 140,
    end: 148,
    text: "Thanks for listening. Tell a friend and we'll be back next week.",
  },
];

export function samplePull(): PullOk {
  return {
    ok: true,
    title: "Night Oven — the Friday the oven died",
    author: "Sample cut",
    duration: 148,
    videoId: null,
    approximate: false,
    engine: "bench",
    note: "Sample tape, not your video. Paste a link to replace it.",
    cues,
    clips: rankClips(cues, 45, 4),
    chapters: [],
  };
}
