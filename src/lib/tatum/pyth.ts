/**
 * Reads a Pyth PriceInfoObject on Sui mainnet through Tatum and decodes the price.
 * Used to settle "markets" picks (e.g. "SUI/USD above $1.00 on Nov 1") against an onchain oracle.
 *
 * Pyth on Sui is a pull oracle: the object only updates when some transaction pushes a fresh price,
 * so we always surface the onchain publish time and a staleness flag instead of pretending it is live.
 */
import type { SuiObjectResponse, TatumSuiClient } from "./suiRpc";

export const PYTH_SUI_USD_FEED_ID = "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744";

export interface OnchainPrice {
  objectId: string;
  feedId: string;
  price: number;
  conf: number;
  emaPrice: number;
  publishTime: string; // ISO
  ageSeconds: number;
  stale: boolean;
}

type F = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const i64 = (x: F): number => {
  const mag = Number(x.fields?.magnitude ?? x.magnitude);
  return (x.fields?.negative ?? x.negative) ? -mag : mag;
};

export function decodePriceInfoObject(obj: SuiObjectResponse, now = Date.now(), staleAfterSec = 3600): OnchainPrice {
  const fields = obj.data?.content?.fields as F | undefined;
  if (!fields || !obj.data?.type?.endsWith("::price_info::PriceInfoObject")) throw new Error("not a Pyth PriceInfoObject");
  const feed = fields.price_info.fields.price_feed.fields;
  const p = feed.price.fields;
  const ema = feed.ema_price.fields;
  const expo = i64(p.expo);
  const scale = 10 ** expo;
  const bytes: number[] = feed.price_identifier.fields.bytes;
  const feedId = "0x" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  const ts = Number(p.timestamp) * 1000;
  const ageSeconds = Math.max(0, Math.round((now - ts) / 1000));
  return {
    objectId: obj.data.objectId,
    feedId,
    price: i64(p.price) * scale,
    conf: Number(p.conf) * scale,
    emaPrice: i64(ema.price) * 10 ** i64(ema.expo),
    publishTime: new Date(ts).toISOString(),
    ageSeconds,
    stale: ageSeconds > staleAfterSec,
  };
}

export async function readPythPrice(client: TatumSuiClient, objectId: string): Promise<OnchainPrice> {
  return decodePriceInfoObject(await client.getObject(objectId));
}
