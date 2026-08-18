import { Notice } from 'obsidian';

// docs/design/05-ui.md §5.2 — every success toast is 3s, the error toast is 5s, no exceptions
const SUCCESS_DURATION_MS = 3000;
const ERROR_DURATION_MS = 5000;

export function toastSuccess(message: string): void {
	new Notice(message, SUCCESS_DURATION_MS);
}

export function toastError(message: string): void {
	new Notice(message, ERROR_DURATION_MS);
}
