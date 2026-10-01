import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatTimecode,
  normalizeInput,
  parseTranscript,
  rankClips,
  youtubeId,
} from "./cues.ts";
import { samplePull } from "./sample.ts";

describe("youtubeId", () => {
  it("reads watch, short, and embed links", () => {
    assert.equal(
      youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      "dQw4w9WgXcQ",
    );
    assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=12"), "dQw4w9WgXcQ");
    assert.equal(
      youtubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
      "dQw4w9WgXcQ",
    );
    assert.equal(youtubeId("not a video"), null);
  });
});

describe("formatTimecode", () => {
  it("drops the hour until it is needed", () => {
    assert.equal(formatTimecode(0), "0:00");
    assert.equal(formatTimecode(65), "1:05");
    assert.equal(formatTimecode(3661), "1:01:01");
  });
});

describe("parseTranscript", () => {
  it("reads srt cues and skips music markers", () => {
    const parsed = parseTranscript(`1
00:00:01,000 --> 00:00:03,000
[Music]

2
00:00:18,000 --> 00:00:21,000
We're no strangers to love
`);
    assert.equal(parsed.approximate, false);
    assert.equal(parsed.cues.length, 1);
    assert.match(parsed.cues[0]!.text, /strangers/);
    assert.equal(parsed.cues[0]!.start, 18);
  });

  it("reads ttml and decodes entities", () => {
    const parsed = parseTranscript(
      `<tt><body><div><p begin="00:00:01.000" end="00:00:03.000">We&#39;re open</p></div></body></tt>`,
    );
    assert.equal(parsed.cues[0]!.text, "We're open");
    assert.equal(parsed.approximate, false);
  });

  it("reads timestamped lines", () => {
    const parsed = parseTranscript(`[12:04] The oven died on a Friday
12:18 - We still opened Saturday`);
    assert.equal(parsed.approximate, false);
    assert.equal(parsed.cues.length, 2);
    assert.equal(parsed.cues[0]!.start, 12 * 60 + 4);
  });

  it("estimates times when the paste has none", () => {
    const parsed = parseTranscript(
      "The oven died on a Friday. We still opened Saturday.",
    );
    assert.equal(parsed.approximate, true);
    assert.ok(parsed.cues.length >= 2);
    assert.ok(parsed.cues[1]!.start > parsed.cues[0]!.start);
  });
});

describe("rankClips", () => {
  const cues = [
    { start: 0, end: 8, text: "Welcome back to the show. I'm Mara." },
    {
      start: 16,
      end: 28,
      text: "This episode is sponsored by Northline flour. Use code OVEN.",
    },
    {
      start: 32,
      end: 48,
      text: "The oven died on a Friday and we still opened Saturday.",
    },
    {
      start: 48,
      end: 64,
      text: "We had 400 orders and one skillet that could take two pans.",
    },
    {
      start: 82,
      end: 98,
      text: "Here's the part nobody puts in the founder story. We were too embarrassed to text the customers.",
    },
  ];

  it("keeps cuts from stacking and prefers the scene over the sponsor", () => {
    const clips = rankClips(cues, 40, 3);
    assert.ok(clips.length >= 1);
    assert.ok(clips.length <= 3);
    for (let i = 0; i < clips.length; i += 1) {
      for (let j = i + 1; j < clips.length; j += 1) {
        const a = clips[i]!;
        const b = clips[j]!;
        assert.ok(!(a.start < b.end - 1 && b.start < a.end - 1));
      }
    }
    assert.match(clips[0]!.excerpt, /oven died|nobody puts/i);
    assert.doesNotMatch(clips[0]!.excerpt, /sponsored/i);
  });

  it("keeps the sample's scene and drops the welcome", () => {
    const clips = samplePull().clips;
    assert.ok(clips.some((clip) => /oven died/i.test(clip.hook)));
    for (const clip of clips) {
      assert.doesNotMatch(`${clip.hook} ${clip.excerpt}`, /welcome back|sponsored|thanks for listening/i);
    }
  });
});

describe("normalizeInput", () => {
  it("clamps length and count", () => {
    const input = normalizeInput({
      url: "  https://youtu.be/dQw4w9WgXcQ  ",
      targetSeconds: 400,
      count: 0,
    });
    assert.equal(input.url, "https://youtu.be/dQw4w9WgXcQ");
    assert.equal(input.targetSeconds, 120);
    assert.equal(input.count, 3);
  });
});
