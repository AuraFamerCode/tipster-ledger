/** Small helpers shared by API route handlers. */
export function ok(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function fail(err: unknown, status = 400): Response {
  const message = err instanceof Error ? err.message : String(err);
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error("expected a JSON body");
  }
}
