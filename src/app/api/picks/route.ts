import { addPick } from "@/lib/engine/service";
import { body, fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Log a pick before the event starts. Body: { eventId, probability (for outcome 0), sourceId? | sourceName?, note? } */
export async function POST(req: Request) {
  try {
    const b = await body<{ eventId: string; probability: number; sourceId?: string; sourceName?: string; note?: string }>(req);
    return ok(await addPick({ ...b, probability: Number(b.probability) }), 201);
  } catch (e) {
    return fail(e);
  }
}
