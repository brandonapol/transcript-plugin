import { createFileRoute } from "@tanstack/react-router";
import { formatTimecode, normalizeInput, type PullOk } from "@/lib/cues";
import { runPull } from "@/lib/run-pull";

const PROTOCOL = "2025-03-26";

function toolText(result: PullOk): string {
  const lines = [
    `${result.title}${result.author ? ` — ${result.author}` : ""}`,
    result.note,
    result.engine === "grok" ? "Hooks marked by Grok." : "Hooks marked on the bench.",
    "",
  ];
  result.clips.forEach((clip, index) => {
    lines.push(
      `${index + 1}. ${formatTimecode(clip.start)}–${formatTimecode(clip.end)} (${clip.kind})`,
      `Hook: ${clip.hook}`,
      `Title: ${clip.title}`,
      `Why: ${clip.why}`,
      clip.excerpt,
      "",
    );
  });
  return lines.filter((line) => line !== undefined).join("\n").trim();
}

const pullTool = {
  name: "pull_hooks",
  description:
    "Pull in and out timestamps and scroll-stopping hooks from an existing YouTube video, or from a pasted SRT, VTT, or timestamped transcript. Returns ranked podcast clip candidates. Does not download or re-encode the video.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "YouTube URL of a video that already exists.",
      },
      transcript: {
        type: "string",
        description:
          "Optional SRT, VTT, or timestamped transcript. Used when captions are missing.",
      },
      targetSeconds: {
        type: "number",
        description: "Desired clip length in seconds. Default 45. Range 15-120.",
      },
      count: {
        type: "number",
        description: "How many clips to return. Default 6. Maximum 8.",
      },
    },
    additionalProperties: false,
  },
};

function rpc(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          id?: unknown;
          method?: string;
          params?: { name?: string; arguments?: Record<string, unknown> };
        } | null;
        if (!body || typeof body !== "object") {
          return rpcError(null, -32700, "Parse error");
        }
        const { id, method, params } = body;
        if (!method || method.startsWith("notifications/") || id === undefined) {
          return new Response(null, { status: 202 });
        }
        if (method === "initialize") {
          return rpc(id, {
            protocolVersion: PROTOCOL,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "hookbench", version: "0.1.0" },
            instructions:
              "Use pull_hooks to get timestamped podcast clips and the opening line for each cut from a YouTube URL or a pasted transcript.",
          });
        }
        if (method === "tools/list") {
          return rpc(id, { tools: [pullTool] });
        }
        if (method === "ping") return rpc(id, {});
        if (method === "tools/call") {
          if (params?.name !== "pull_hooks") {
            return rpcError(id, -32602, `Unknown tool ${params?.name ?? ""}`);
          }
          const result = await runPull(normalizeInput(params.arguments ?? {}));
          return rpc(id, {
            content: [
              {
                type: "text",
                text: result.ok ? toolText(result) : result.error,
              },
            ],
            isError: !result.ok,
          });
        }
        return rpcError(id, -32601, `Method not found: ${method}`);
      },
    },
  },
});
