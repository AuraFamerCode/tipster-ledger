import { settleAndRemember } from "@/lib/engine/service";
import { body, fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Record a result (0 = first outcome won, 1 = second) and write the new scorecard to memory. */
export async function POST(req: Request) {
  try {
    const b = await body<{ eventId: string; result: 0 | 1; source?: string }>(req);
    if (b.result !== 0 && b.result !== 1) throw new Error("result must be 0 or 1");
    const { event, stored } = await settleAndRemember(b.eventId, b.result, b.source ?? "entered manually");
    return ok({ settled: event.id, wrote: stored.length });
  } catch (e) {
    return fail(e);
  }
}
