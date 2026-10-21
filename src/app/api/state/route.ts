import { dashboard } from "@/lib/engine/service";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await dashboard());
  } catch (e) {
    return fail(e, 500);
  }
}
