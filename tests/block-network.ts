import { vi } from "vitest";

vi.stubGlobal("fetch", async () => {
  throw new Error("Unexpected network request in an offline test. Mock fetch for this test.");
});
