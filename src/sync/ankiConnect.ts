import { requestUrl } from 'obsidian';
import { AnkiConnectError } from '../types';
import { TimeoutError, withTimeout } from '../utils/timeout';

interface AnkiConnectResponse<T> {
	result: T;
	error: string | null;
}

export class AnkiConnectClient {
	constructor(
		private url: string,
		private timeoutMs = 5000,
	) {}

	async invoke<T>(
		action: string,
		params: Record<string, unknown> = {},
	): Promise<T> {
		let text: string;
		try {
			const response = await withTimeout(
				requestUrl({
					url: this.url,
					method: 'POST',
					contentType: 'application/json',
					body: JSON.stringify({ action, version: 6, params }),
					throw: false,
				}),
				this.timeoutMs,
			);
			text = response.text;
		} catch (err) {
			if (err instanceof TimeoutError) {
				throw new AnkiConnectError(
					action,
					`timed out after ${this.timeoutMs}ms`,
				);
			}
			throw new AnkiConnectError(
				action,
				'could not reach AnkiConnect — is Anki running?',
			);
		}

		let data: AnkiConnectResponse<T>;
		try {
			data = JSON.parse(text) as AnkiConnectResponse<T>;
		} catch {
			throw new AnkiConnectError(
				action,
				'received a non-JSON response from AnkiConnect',
			);
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

	async updateNoteFields(
		noteId: number,
		fields: Record<string, string>,
	): Promise<void> {
		await this.invoke<null>('updateNoteFields', {
			note: { id: noteId, fields },
		});
	}

	// Current field values of one note, keyed by field name, plus its `mod` (seconds).
	async noteInfo(
		noteId: number,
	): Promise<{ fields: Record<string, string>; mod: number }> {
		const [info] = await this.invoke<
			{ fields?: Record<string, { value: string }>; mod?: number }[]
		>('notesInfo', { notes: [noteId] });
		return {
			fields: Object.fromEntries(
				Object.entries(info?.fields ?? {}).map(([k, f]) => [
					k,
					f.value,
				]),
			),
			mod: info?.mod ?? 0,
		};
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

	async version(): Promise<number> {
		return this.invoke<number>('version');
	}

	// Raw base64 of a file in Anki's media folder; false when there is no such file.
	async retrieveMediaFile(filename: string): Promise<string | false> {
		return this.invoke<string | false>('retrieveMediaFile', { filename });
	}

	// Returns the filename Anki actually stored under (it renames on a collision).
	async storeMediaFile(
		filename: string,
		base64Data: string,
	): Promise<string> {
		return this.invoke<string>('storeMediaFile', {
			filename,
			data: base64Data,
		});
	}
}
