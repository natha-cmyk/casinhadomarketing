import { describe, expect, it, beforeEach } from "vitest";
import { bust, cached, pruneTtlStore, resetTtlCacheForTests, type TtlEntry } from "./ttl-cache";

describe("cache TTL", () => {
  beforeEach(() => {
    resetTtlCacheForTests();
  });

  it("uma chamada em voo atende os pedidos simultâneos", async () => {
    let n = 0;
    const fn = () =>
      new Promise<number>((resolve) => {
        n += 1;
        setTimeout(() => resolve(n), 20);
      });
    const [a, b] = await Promise.all([cached("k", 5_000, fn), cached("k", 5_000, fn)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(n).toBe(1);
    await expect(cached("k", 5_000, async () => 9)).resolves.toBe(1);
  });

  it("não guarda falha", async () => {
    let n = 0;
    const fn = async () => {
      n += 1;
      if (n === 1) throw new Error("x");
      return "ok";
    };
    await expect(cached("e", 5_000, fn)).rejects.toThrow("x");
    await expect(cached("e", 5_000, fn)).resolves.toBe("ok");
    expect(n).toBe(2);
  });

  it("bust impede que o in-flight regrave o valor velho", async () => {
    let release: (v: string) => void = () => {};
    const pending = cached("crmleads:ws:1", 60_000, () => new Promise<string>((resolve) => {
      release = resolve;
    }));
    bust("crmleads:ws");
    release("stale");
    await expect(pending).resolves.toBe("stale");
    await expect(cached("crmleads:ws:1", 60_000, async () => "fresh")).resolves.toBe("fresh");
  });

  it("a poda usa o ttl da entrada e o teto", () => {
    const now = 1_000_000;
    const store = new Map<string, TtlEntry>();
    store.set("keep", { at: now - 50, ttl: 60_000, v: "stay" });
    for (let i = 0; i < 5; i++) store.set(`s${i}`, { at: now - 20, ttl: 1, v: i });
    pruneTtlStore(store, 3, now);
    expect(store.get("keep")?.v).toBe("stay");
    expect(store.size).toBe(1);

    const capped = new Map<string, TtlEntry>();
    for (let i = 0; i < 4; i++) capped.set(`k${i}`, { at: now, ttl: 60_000, v: i });
    pruneTtlStore(capped, 2, now);
    expect([...capped.keys()]).toEqual(["k2", "k3"]);
  });
});
