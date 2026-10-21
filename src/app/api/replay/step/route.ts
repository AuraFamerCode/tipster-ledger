import { replayStep } from "@/lib/engine/service";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // MemWal waits for the Walrus upload to certify

/** Demo: reveal the next real result, score every pick, write the scorecard (+ lessons) to memory. */
export async function POST() {
  try {
    const { event, stored } = await replayStep();
    return ok({ settled: event.id, wrote: stored.map((s) => ({ kind: s.memory.kind, blobId: s.blobId, lesson: s.memory.lesson })) });
  } catch (e) {
    return fail(e);
  }
}
