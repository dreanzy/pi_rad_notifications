/**
 * Pi 通知扩展
 *
 * 通知场景：
 * - agent_end（正常完成）    → ✅ Pi 处理完成
 * - agent_end（出错）        → ❌ Pi 处理出错
 * - agent_end（被中止）      → ⛔ Pi 被中止
 * - tool_execution_start(ask_user_question) → 💬 Pi 正在询问...
 * - 长时间 bash 执行结束     → ⚡ bash 执行完成
 *
 * 灵感来源：Reasonix (rx) 的 toast.ps1 通知机制
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
	ExtensionAPI,
	AgentEndEvent,
} from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 当前脚本所在目录（扩展目录） */
const EXT_DIR = dirname(fileURLToPath(import.meta.url));
const PS1_PATH = join(EXT_DIR, "toast.ps1");

/** 是否在 Windows 环境 */
const IS_WINDOWS = process.platform === "win32";

/** 是否为子 agent 进程（pi-subagents 设置的环境变量） */
const IS_SUBAGENT = process.env.PI_SUBAGENT_CHILD === "1";

/** 长时间工具执行的时间阈值（毫秒） */
const LONG_TOOL_THRESHOLD_MS = 120_000;

// ─── 工具执行时间跟踪 ────────────────────────────────────────────────────────

/** 记录 bash tool 的开始时间戳 */
const toolStartTimes = new Map<string, number>();

// ─── Windows Toast ───────────────────────────────────────────────────────────

function notifyWindows(event: string, toolName?: string): void {
	try {
		const args = `-NoProfile -ExecutionPolicy Bypass -File "${PS1_PATH}" -event "${event}"${toolName ? ` -toolName "${toolName}"` : ""}`;
		execSync(`powershell.exe ${args}`, { timeout: 5000, windowsHide: true });
	} catch {
		// 非关键功能，静默忽略
	}
}

// ─── 终端通知 (OSC 777) ──────────────────────────────────────────────────────

function notifyTerminal(body: string): void {
	try {
		process.stdout.write(`\x1b]777;notify;Pi;${body}\x07`);
	} catch {
		// 终端不支持 OSC 777 时静默忽略
	}
}

// ─── 统一通知入口 ────────────────────────────────────────────────────────────

function notify(event: string, toolName?: string): void {
	// 子 agent 只保留错误通知，其余静音
	if (IS_SUBAGENT && event !== "agent_error") return;

	if (IS_WINDOWS && existsSync(PS1_PATH)) {
		notifyWindows(event, toolName);
	} else {
		const map: Record<string, string> = {
			agent_end: "✅ Pi 处理完成",
			agent_error: "❌ Pi 处理出错",
			agent_aborted: "⛔ Pi 被中止",
			tool_ask: "💬 Pi 正在询问...",
			tool_bash_done: "⚡ bash 执行完成",
		};
		notifyTerminal(map[event] || "⏳ Pi 处理中...");
	}
}

// ─── 扩展入口 ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// 子 agent 通知过滤已在 notify() 中处理

	// ── agent_end ─────────────────────────────────────────────────────────
	pi.on("agent_end", async (event: AgentEndEvent) => {
		const lastMsg = event.messages
			.filter((m) => m.role === "assistant")
			.at(-1) as AssistantMessage | undefined;

		if (!lastMsg) {
			notify("agent_end");
			return;
		}
		if (lastMsg.errorMessage) {
			notify(
				lastMsg.stopReason === "aborted" ? "agent_aborted" : "agent_error",
			);
			return;
		}
		notify("agent_end");
	});

	// ── tool_execution_start ──────────────────────────────────────────────
	// 跟踪工具执行时间，给长时间工具准备
	pi.on("tool_execution_start", async (event) => {
		if (event.toolName === "bash") {
			toolStartTimes.set(event.toolCallId, Date.now());
		} else if (
			event.toolName === "ask_user_question" ||
			event.toolName === "ask"
		) {
			notify("tool_ask");
		}
	});

	// ── tool_execution_end ────────────────────────────────────────────────
	// 长时间 bash 执行完成后通知
	pi.on("tool_execution_end", async (event) => {
		if (event.toolName !== "bash") return;
		const startTime = toolStartTimes.get(event.toolCallId);
		toolStartTimes.delete(event.toolCallId);

		if (startTime && !event.isError) {
			const elapsed = Date.now() - startTime;
			if (elapsed >= LONG_TOOL_THRESHOLD_MS) {
				notify("tool_bash_done");
			}
		}
	});
}
