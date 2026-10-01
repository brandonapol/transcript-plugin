import { createServerFn } from "@tanstack/react-start";
import { normalizeInput, type PullResult } from "./cues.ts";

export const pullHooks = createServerFn({ method: "POST" })
  .validator((data: unknown) => normalizeInput(data))
  .handler(async ({ data }): Promise<PullResult> => {
    const { runPull } = await import("./run-pull.ts");
    return runPull(data);
  });
