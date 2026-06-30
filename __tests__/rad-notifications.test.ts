import { describe, it, expect } from "vitest";

describe("rad-notifications", () => {
	it("exports a default extension function", async () => {
		const mod = await import("../extensions/index.js");
		expect(typeof mod.default).toBe("function");
	});
});
