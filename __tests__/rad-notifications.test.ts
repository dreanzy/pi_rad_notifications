import { describe, it, expect, vi } from "vitest";

// Mock node:child_process execSync
vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

describe("rad-notifications", () => {
	it("exports a default extension function", async () => {
		const mod = await import("../extensions/index.js");
		expect(typeof mod.default).toBe("function");
	});
});
