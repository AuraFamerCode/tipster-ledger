/**
 * Minimal, typed Sui JSON-RPC client for the Tatum gateway.
 *   URL:  https://sui-mainnet.gateway.tatum.io   (testnet: sui-testnet.gateway.tatum.io)
 *   Auth: header `x-api-key: <TATUM_API_KEY>` (the gateway also answers keyless, heavily rate-limited)
 * Only methods Tatum lists as supported for Sui are used (see https://sui-mainnet.gateway.tatum.io/llms.txt).
 */

export interface SuiRpcOptions {
  url?: string;
  apiKey?: string;
  retries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class SuiRpcError extends Error {
  constructor(message: string, readonly code?: number, readonly httpStatus?: number) {
    super(message);
  }
}

export interface SuiObjectResponse {
  data?: {
    objectId: string;
    version: string;
    digest: string;
    type?: string;
    owner?: unknown;
    content?: { dataType: string; type: string; fields: Record<string, unknown> };
  };
  error?: { code: string };
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export class TatumSuiClient {
  readonly url: string;
  private readonly apiKey?: string;
  private readonly retries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private id = 0;

  constructor(opts: SuiRpcOptions = {}) {
    this.url = opts.url ?? process.env.TATUM_SUI_RPC_URL ?? "https://sui-mainnet.gateway.tatum.io";
    this.apiKey = opts.apiKey ?? process.env.TATUM_API_KEY ?? undefined;
    this.retries = opts.retries ?? 3;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get authenticated(): boolean {
    return Boolean(this.apiKey);
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    const body = JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params });
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(this.url, { method: "POST", headers, body });
      if ((res.status === 429 || res.status >= 500) && attempt < this.retries) {
        await this.sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new SuiRpcError(`Tatum ${method}: HTTP ${res.status}`, undefined, res.status);
      const json = (await res.json()) as { result?: T; error?: { code: number; message: string } };
      if (json.error) throw new SuiRpcError(`Tatum ${method}: ${json.error.message}`, json.error.code);
      return json.result as T;
    }
  }

  getChainIdentifier() {
    return this.call<string>("sui_getChainIdentifier");
  }
  getLatestCheckpoint() {
    return this.call<string>("sui_getLatestCheckpointSequenceNumber");
  }
  getReferenceGasPrice() {
    return this.call<string>("suix_getReferenceGasPrice");
  }
  getObject(id: string) {
    return this.call<SuiObjectResponse>("sui_getObject", [id, { showContent: true, showType: true, showOwner: true }]);
  }
  multiGetObjects(ids: string[]) {
    return this.call<SuiObjectResponse[]>("sui_multiGetObjects", [ids, { showContent: true, showType: true }]);
  }
  getBalance(owner: string, coinType = "0x2::sui::SUI") {
    return this.call<{ coinType: string; totalBalance: string }>("suix_getBalance", [owner, coinType]);
  }
  getOwnedObjects(owner: string, structType?: string, cursor: string | null = null, limit = 50) {
    const query = { filter: structType ? { StructType: structType } : null, options: { showType: true, showContent: true } };
    return this.call<Page<SuiObjectResponse>>("suix_getOwnedObjects", [owner, query, cursor, limit]);
  }
  getDynamicFields(parentId: string, cursor: string | null = null, limit = 50) {
    return this.call<Page<{ name: { type: string; value: unknown }; objectId: string; objectType: string }>>("suix_getDynamicFields", [
      parentId,
      cursor,
      limit,
    ]);
  }
  queryEvents(filter: Record<string, unknown>, cursor: unknown = null, limit = 20, descending = true) {
    return this.call<Page<{ type: string; parsedJson: Record<string, unknown>; timestampMs?: string; id: { txDigest: string } }>>(
      "suix_queryEvents",
      [filter, cursor, limit, descending],
    );
  }
}
