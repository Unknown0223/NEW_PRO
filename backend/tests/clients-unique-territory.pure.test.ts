import { describe, expect, it } from "vitest";
import {
  isSameClientIdentity,
  territoriesMatch
} from "../src/modules/clients/clients.unique-territory";

describe("clients.unique-territory", () => {
  it("matches territory case-insensitively", () => {
    expect(
      territoriesMatch(
        { region: "Toshkent", zone: "A", city: "Chilonzor" },
        { region: "toshkent", zone: "a", city: "chilonzor" }
      )
    ).toBe(true);
    expect(
      territoriesMatch({ region: "Toshkent", city: "A" }, { region: "Toshkent", city: "B" })
    ).toBe(false);
  });

  it("same identity when name+territory+INN match", () => {
    expect(
      isSameClientIdentity(
        {
          name: "Magazin",
          region: "Toshkent",
          city: "Chilonzor",
          inn: "123456789"
        },
        {
          name: "magazin",
          region: "Toshkent",
          city: "Chilonzor",
          inn: "123456789"
        }
      )
    ).toBe(true);
  });

  it("same identity when name+territory+PINFL match", () => {
    expect(
      isSameClientIdentity(
        {
          name: "Magazin",
          region: "Samarqand",
          client_pinfl: "30101890123456"
        },
        {
          name: "Magazin",
          region: "Samarqand",
          client_pinfl: "30101890123456"
        }
      )
    ).toBe(true);
  });

  it("rejects when territory differs even if INN matches", () => {
    expect(
      isSameClientIdentity(
        { name: "Magazin", city: "A", inn: "123456789" },
        { name: "Magazin", city: "B", inn: "123456789" }
      )
    ).toBe(false);
  });

  it("name+territory without INN/PINFL is identity", () => {
    expect(
      isSameClientIdentity(
        { name: "Magazin", city: "A" },
        { name: "Magazin", city: "A" }
      )
    ).toBe(true);
  });
});
