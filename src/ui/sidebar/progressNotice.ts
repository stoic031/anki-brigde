import { Notice } from 'obsidian';

export interface ProgressNotice {
	// Changes the base text; the elapsed-seconds suffix keeps counting from when the
	// notice was first shown, not reset per phase.
	update(message: string): void;
	// Clears the ticking interval and hides the notice.
	stop(): void;
}

function withElapsed(base: string, seconds: number): string {
	return seconds > 0 ? `${base} (${seconds}s)` : base;
}

// docs/design/05-ui.md §5.3 / .claude/rules/ui-copy.md — a persistent Notice (does not
// auto-dismiss) for AI calls that can take 5-30s, ticking an elapsed-seconds counter so
// a static, unchanging message never sits on screen for that long.
export function startProgressNotice(initial: string): ProgressNotice {
	let base = initial;
	const start = Date.now();
	const notice = new Notice(base, 0);

	const interval = window.setInterval(() => {
		notice.setMessage(
			withElapsed(base, Math.floor((Date.now() - start) / 1000)),
		);
	}, 1000);

	return {
		update(message) {
			base = message;
		},
		stop() {
			window.clearInterval(interval);
			notice.hide();
		},
	};
}
