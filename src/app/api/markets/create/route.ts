import { addEvent } from "@/lib/engine/service";
import { body, fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create an onchain-resolved price question: "SUI/USD >= threshold at lock time?" (resolved by Pyth on Sui via Tatum). */
export async function POST(req: Request) {
  try {
    const b = await body<{ threshold: number; hoursFromNow?: number }>(req);
    const threshold = Number(b.threshold);
    if (!(threshold > 0)) throw new Error("threshold must be a positive USD price");
    const startsAt = new Date(Date.now() + (b.hoursFromNow ?? 24) * 3600_000).toISOString();
    const objectId = process.env.PYTH_SUI_USD_OBJECT_ID ?? "0x801dbc2f0053d34734814b2d6df491ce7807a725fe9a01ad74a07e9c51396c37";
    const ev = await addEvent({
      sport: "markets",
      competition: "crypto-price",
      title: `SUI/USD at or above $${threshold.toFixed(2)} at ${startsAt.slice(0, 16).replace("T", " ")} UTC?`,
      outcomes: ["Yes", "No"],
      startsAt,
      resolver: { kind: "pyth", objectId, threshold, pair: "SUI/USD" },
    });
    return ok(ev, 201);
  } catch (e) {
    return fail(e);
  }
}
