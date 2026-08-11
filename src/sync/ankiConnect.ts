import { requestUrl } from 'obsidian';
import { AnkiConnectError } from '../types';

interface AnkiConnectResponse<T> {
	result: T;
	error: string | null;
}

export class AnkiConnectClient {
	constructor(
		private url: string,
		private timeoutMs = 5000,
	) {}

	async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
		// requestUrl (not fetch) — bypasses CORS restrictions fetch hits in Obsidian's
		// renderer, and requestUrl has no built-in timeout, so we race one ourselves.
		const timeoutError = new Error('timeout');
		let timer: ReturnType<typeof window.setTimeout> | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = window.setTimeout(() => reject(timeoutError), this.timeoutMs);
		});

		let text: string;
		try {
			const response = await Promise.race([
				requestUrl({
					url: this.url,
					method: 'POST',
					contentType: 'application/json',
					body: JSON.stringify({ action, version: 6, params }),
					throw: false,
				}),
				timeout,
			]);
			text = response.text;
		} catch (err) {
			if (err === timeoutError) {
				throw new AnkiConnectError(action, `timed out after ${this.timeoutMs}ms`);
			}
			throw new AnkiConnectError(action, 'could not reach AnkiConnect — is Anki running?');
		} finally {
			window.clearTimeout(timer);
		}

		let data: AnkiConnectResponse<T>;
		try {
			data = JSON.parse(text) as AnkiConnectResponse<T>;
		} catch {
			throw new AnkiConnectError(action, 'received a non-JSON response from AnkiConnect');
		}

		if (data.error) throw new AnkiConnectError(action, data.error);
		return data.result;
	}

	async addNote(note: {
		deckName: string;
		modelName: string;
		fields: Record<string, string>;
		tags?: string[];
	}): Promise<number> {
		return this.invoke<number>('addNote', {
			note: {
				deckName: note.deckName,
				modelName: note.modelName,
				fields: note.fields,
				tags: note.tags ?? [],
			},
		});
	}

	async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> {
		await this.invoke<null>('updateNoteFields', { note: { id: noteId, fields } });
	}

	async deleteNotes(noteIds: number[]): Promise<void> {
		await this.invoke<null>('deleteNotes', { notes: noteIds });
	}

	async deckNames(): Promise<string[]> {
		return this.invoke<string[]>('deckNames');
	}

	async modelNames(): Promise<string[]> {
		return this.invoke<string[]>('modelNames');
	}

	async modelFieldNames(modelName: string): Promise<string[]> {
		return this.invoke<string[]>('modelFieldNames', { modelName });
	}
}
