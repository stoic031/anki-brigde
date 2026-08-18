// AGENTS.md — "Settings validation before save: ... URLs parse."
export function isValidUrl(value: string): boolean {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}
