/**
 * Headless demo replay: settles the real seed matches one by one and writes every scorecard + lesson to
 * the configured memory store (Walrus Memory on Sui mainnet when MEMWAL_* is set). Paced for the managed
 * relayer's limits (30 points/min per delegate key; remember = 5, bulk = 10).
 * Usage: npm run memwal:replay -- [matches=20] [pauseSeconds=25]
 */
import "dotenv/config";
import { getMemoryStore } from "../src/lib/memory";
import { dashboard, replayStep } from "../src/lib/engine/service";

const matches = Number(process.argv[2] ?? 20);
const pause = Number(process.argv[3] ?? 25) * 1000;
const store = await getMemoryStore();
console.log(`memory backend: ${JSON.stringify(store.info())}`);
console.log(`health: ${JSON.stringify(await store.health())}`);

let written = 0;
for (let i = 0; i < matches; i++) {
  try {
    const { event, stored } = await replayStep();
    written += stored.length;
    console.log(`#${i + 1} ${event.title} -> ${event.outcomes[event.result!]} won; wrote ${stored.length} (${stored.map((s) => s.blobId ?? "local").join(", ")})`);
    for (const s of stored) if (s.memory.lesson) console.log(`    lesson: ${s.memory.lesson}`);
  } catch (e) {
    console.log(`stopped: ${(e as Error).message}`);
    break;
  }
  if (store.info().backend === "memwal" && i < matches - 1) await new Promise((r) => setTimeout(r, pause));
}
const d = await dashboard();
console.log(`\nmemories written this run: ${written}; total in cache: ${d.memory.count}`);
console.log(`memory lift (all): ${JSON.stringify(d.lift.all)}`);
