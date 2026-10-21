import { loadState, settleAndRemember } from "@/lib/engine/service";
import { body, fail, ok } from "@/lib/http";
import { readPythPrice } from "@/lib/tatum/pyth";
import { TatumSuiClient } from "@/lib/tatum/suiRpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Settle a "markets" event from the Pyth PriceInfoObject on Sui mainnet, read through Tatum.
 * Only settles if the onchain price was published AFTER the event's lock time; otherwise says why not.
 */
export async function POST(req: Request) {
  try {
    const { eventId } = await body<{ eventId: string }>(req);
    const ev = loadState().events.find((e) => e.id === eventId);
    if (!ev?.resolver || ev.resolver.kind !== "pyth") throw new Error("event has no onchain resolver");
    const price = await readPythPrice(new TatumSuiClient(), ev.resolver.objectId);
    if (new Date(price.publishTime) < new Date(ev.startsAt))
      return ok({ settled: false, reason: `Onchain price last published ${price.publishTime}, before the lock time ${ev.startsAt}. Pyth on Sui is a pull oracle; try again after the next update.`, price });
    const result: 0 | 1 = price.price >= ev.resolver.threshold ? 0 : 1;
    await settleAndRemember(ev.id, result, `Pyth ${ev.resolver.pair} ${price.price.toFixed(4)} @ ${price.publishTime} (object ${price.objectId}, via Tatum)`);
    return ok({ settled: true, result, price });
  } catch (e) {
    return fail(e);
  }
}
