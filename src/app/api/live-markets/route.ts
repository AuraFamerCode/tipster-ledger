import { fail, ok } from "@/lib/http";
import { fetchUpcomingCricket } from "@/lib/polymarket/gamma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upcoming cricket match-winner markets from Polymarket's public Gamma API. */
export async function GET() {
  try {
    return ok({ events: await fetchUpcomingCricket(8) });
  } catch (e) {
    return fail(e, 502);
  }
}
