import { describe, expect, it } from "vitest";
import { accountsForProfile } from "./account-scope";

describe("accountsForProfile", () => {
  it("descarta conta de outro profile e conta sem profile quando a lista vem marcada", () => {
    const rows = [
      { _id: "a", profileId: "p1" },
      { _id: "b", profileId: { _id: "p2" } },
      { _id: "c" },
    ];
    expect(accountsForProfile(rows, "p1").map((r) => r._id)).toEqual(["a"]);
  });

  it("mantém a lista inteira quando o provedor não manda profileId", () => {
    const rows = [{ _id: "a" }, { _id: "b", profileId: null }];
    expect(accountsForProfile(rows, "p1")).toEqual(rows);
  });
});
