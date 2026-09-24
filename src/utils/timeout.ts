export class TimeoutError extends Error {}

// requestUrl (not fetch) avoids CORS in Obsidian's renderer but has no built-in timeout,
// so every call races one. window timers for popout-window compatibility.
export async function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
): Promise<T> {
	let timer: number | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = window.setTimeout(() => reject(new TimeoutError()), ms);
			}),
		]);
	} finally {
		window.clearTimeout(timer);
	}
}
