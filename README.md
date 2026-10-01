# Hookbench

Pull timestamps and hooks out of a video that already exists.

Paste a YouTube link. Hookbench reads the timed captions, skips the intro and the sponsor read, and returns a cut list: in-point, out-point, and the line that should open the clip. If the video has no captions, paste an SRT, a VTT, or lines like `12:04 The oven died on a Friday`.

This is the tool behind the cut desk, and the same call ChatGPT makes.

## ChatGPT

Connect the published app as an MCP server at `/api/mcp`.

Tool: `pull_hooks`

| Argument | What it is |
| --- | --- |
| `url` | YouTube link for a video you already have |
| `transcript` | Optional SRT, VTT, or timestamped transcript |
| `targetSeconds` | Clip length, 15–120, default 45 |
| `count` | How many cuts, 3–8, default 6 |

Ask ChatGPT: "Pull hooks from this episode" and give it the link.

`POST /api/pull` accepts the same JSON body and returns the cut list for anything that is not an MCP client.

Hooks are rewritten by Grok when a server key is present. If it isn't, the bench still marks the cuts from the transcript itself. The key is injected at runtime. It is never stored in this repo.

## What a cut looks like

Each clip has a start, an end, a hook, a short title, why it cuts, and a kind: story, contrarian, howto, confession, stat, or quote. Overlapping windows are dropped. Ads, welcomes, and outros are scored down.

## Tests

```sh
node --experimental-strip-types --test src/lib/cues.test.ts
```

That check runs on every push.
