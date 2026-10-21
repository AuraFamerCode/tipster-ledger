import { addEvent } from "@/lib/engine/service";
import { body, fail, ok } from "@/lib/http";
import type { LedgerEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Add an event to the ledger (custom, or imported from /api/live-markets). Bookmaker odds are decimal, e.g. [1.65, 2.30]. */
export async function POST(req: Request) {
  try {
    const b = await body<Partial<LedgerEvent>>(req);
    if (!b.title || !b.outcomes || b.outcomes.length !== 2 || !b.startsAt) throw new Error("title, outcomes[2] and startsAt are required");
    if (b.bookmakerOdds && !b.bookmakerOdds.every((o) => Number(o) > 1)) throw new Error("bookmaker odds must be decimal odds > 1");
    const ev = await addEvent({
      id: b.id,
      sport: b.sport ?? "cricket",
      competition: b.competition ?? "Other",
      title: b.title.slice(0, 160),
      outcomes: [String(b.outcomes[0]), String(b.outcomes[1])],
      startsAt: new Date(b.startsAt).toISOString(),
      marketPrice: b.marketPrice,
      marketSource: b.marketSource,
      bookmakerOdds: b.bookmakerOdds ? [Number(b.bookmakerOdds[0]), Number(b.bookmakerOdds[1])] : undefined,
      resolver: b.resolver,
    });
    return ok(ev, 201);
  } catch (e) {
    return fail(e);
  }
}
