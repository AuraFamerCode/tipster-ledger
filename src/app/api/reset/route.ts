import { resetLocal } from "@/lib/engine/service";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Wipe local state and the local memory cache. Walrus Memory is NOT touched. */
export async function POST() {
  try {
    return ok(await resetLocal());
  } catch (e) {
    return fail(e, 500);
  }
}
