import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Isolate state + local memory store in a temp dir and force the local backend.
beforeAll(() => {
  process.env.TIPSTER_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "tipster-"));
  process.env.MEMORY_BACKEND = "local";
});

describe("service (local backend, end to end)", () => {
  it("replays, survives a local wipe, and restores from memory", async () => {
    const svc = await import("@/lib/engine/service");
    for (let i = 0; i < 4; i++) await svc.replayStep();
    const d1 = await svc.dashboard();
    expect(d1.replay.settled).toBe(4);
    expect(d1.memory.backend).toBe("local");
    expect(d1.memory.count).toBeGreaterThanOrEqual(4);
    expect(d1.memory.hasMemory).toBe(true);

    await svc.resetLocal();
    const d2 = await svc.dashboard();
    expect(d2.replay.settled).toBe(0);
    expect(d2.memory.hasMemory).toBe(false);

    const r = await svc.restoreFromMemory();
    expect(r.eventsRestored).toBe(4);
    const d3 = await svc.dashboard();
    expect(d3.replay.settled).toBe(4);
    expect(d3.memory.hasMemory).toBe(true);
    expect(d3.leaderboard.find((l) => l.source.id === "polymarket")?.remembered?.n).toBe(4);
  });

  it("rejects picks after the start and accepts picks on a future custom event", async () => {
    const svc = await import("@/lib/engine/service");
    const past = svc.loadState().events.find((e) => e.result === undefined)!; // a real match that already started
    await expect(svc.addPick({ eventId: past.id, probability: 0.6, sourceName: "Me" })).rejects.toThrow(/lock/);
    const ev = await svc.addEvent({
      sport: "cricket",
      competition: "T20",
      title: "India vs Australia",
      outcomes: ["India", "Australia"],
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      bookmakerOdds: [1.8, 2.05],
    });
    const pick = await svc.addPick({ eventId: ev.id, probability: 0.62, sourceName: "Cricket Twitter Guy" });
    expect(pick.sourceId).toBe("src-cricket-twitter-guy");
    const d = await svc.dashboard();
    expect(d.leaderboard.some((l) => l.source.name === "Cricket Twitter Guy")).toBe(true);
  });
});
