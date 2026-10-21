import { restoreFromMemory } from "@/lib/engine/service";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Recall credibility memories (Walrus Memory on mainnet when configured) and rebuild the ledger from them. */
export async function POST() {
  try {
    return ok(await restoreFromMemory());
  } catch (e) {
    return fail(e, 502);
  }
}
