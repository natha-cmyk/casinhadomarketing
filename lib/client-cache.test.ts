import { beforeEach, describe, expect, it } from "vitest";
import { clearClientCaches, clientCacheScope, scopedCache, setClientCacheScope } from "./client-cache";

describe("cache do browser por workspace", () => {
  const cache = scopedCache<string>();

  beforeEach(() => {
    clearClientCaches();
  });

  it("não lê nem grava sem workspace", () => {
    cache.set("a|b", "vazou");
    expect(cache.get("a|b")).toBeUndefined();
  });

  it("isola por workspace e zera na troca e no logout", () => {
    setClientCacheScope("ws-a");
    cache.set("jan", "resumo-a");
    expect(cache.get("jan")).toBe("resumo-a");

    setClientCacheScope("ws-b");
    expect(cache.get("jan")).toBeUndefined();
    cache.set("jan", "resumo-b");
    expect(cache.get("jan")).toBe("resumo-b");

    setClientCacheScope("ws-a");
    expect(cache.get("jan")).toBeUndefined();

    setClientCacheScope("ws-a");
    cache.set("jan", "de-novo");
    clearClientCaches();
    expect(clientCacheScope()).toBe("");
    expect(cache.get("jan")).toBeUndefined();
  });
});
