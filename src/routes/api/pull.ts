import { createFileRoute } from "@tanstack/react-router";
import { normalizeInput } from "@/lib/cues";
import { runPull } from "@/lib/run-pull";

export const Route = createFileRoute("/api/pull")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const result = await runPull(normalizeInput(body));
        return Response.json(result);
      },
    },
  },
});
