import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnkiConnectClient } from './ankiConnect';
import { AnkiConnectError } from '../types';

const { requestUrl } = vi.hoisted(() => ({
	requestUrl: vi.fn<
		(params: {
			url: string;
			method?: string;
			contentType?: string;
			body?: string;
			throw?: boolean;
		}) => Promise<{ text: string }>
	>(),
}));

vi.mock('obsidian', () => ({ requestUrl }));

beforeEach(() => {
	requestUrl.mockReset();
	// vitest runs in a plain Node environment (no `window`), but ankiConnect.ts
	// deliberately calls window.setTimeout/clearTimeout for Obsidian popout-window
	// compatibility — alias window to globalThis so those calls resolve in tests.
	// (obsidianmd/no-global-this fires here; this repo disallows disabling it, and
	// the warning is expected for this test-only shim, not application code.)
	vi.stubGlobal('window', globalThis);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function jsonResponse(body: unknown): { text: string } {
	return { text: JSON.stringify(body) };
}

function sentBody(): unknown {
	const call = requestUrl.mock.calls[0];
	if (!call?.[0].body) throw new Error('requestUrl was not called with a body');
	return JSON.parse(call[0].body);
}

describe('AnkiConnectClient.invoke', () => {
	it('resolves with the result on success', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: ['Default'], error: null }));
		const client = new AnkiConnectClient('http://localhost:8765');
		await expect(client.invoke('deckNames')).resolves.toEqual(['Default']);
	});

	it('throws AnkiConnectError when AnkiConnect returns an error field', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: null, error: 'model was not found' }));
		const client = new AnkiConnectClient('http://localhost:8765');
		await expect(client.invoke('modelNames')).rejects.toThrow(AnkiConnectError);
	});

	it('throws AnkiConnectError when AnkiConnect is unreachable', async () => {
		requestUrl.mockRejectedValue(new Error('ECONNREFUSED'));
		const client = new AnkiConnectClient('http://localhost:8765');
		await expect(client.invoke('deckNames')).rejects.toThrow(AnkiConnectError);
	});

	it('throws AnkiConnectError on a non-JSON response body', async () => {
		requestUrl.mockResolvedValue({ text: 'not json' });
		const client = new AnkiConnectClient('http://localhost:8765');
		await expect(client.invoke('deckNames')).rejects.toThrow(AnkiConnectError);
	});

	it('throws AnkiConnectError when the request times out', async () => {
		vi.useFakeTimers();
		try {
			requestUrl.mockReturnValue(new Promise(() => {}));
			const client = new AnkiConnectClient('http://localhost:8765', 1000);
			// Attach the rejection handler synchronously, before advancing fake
			// timers — otherwise the promise can reject before anything is
			// listening, which vitest/Node reports as an unhandled rejection.
			const captured = client.invoke('deckNames').catch((err: unknown) => err);
			await vi.advanceTimersByTimeAsync(1000);

			const error = await captured;
			expect(error).toBeInstanceOf(AnkiConnectError);
			expect(error).toMatchObject({ action: 'deckNames' });
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('AnkiConnectClient action methods', () => {
	function client(): AnkiConnectClient {
		return new AnkiConnectClient('http://localhost:8765');
	}

	it('addNote sends deck/model/fields/tags and resolves to the new noteId', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: 1698765432109, error: null }));
		const result = await client().addNote({
			deckName: 'Japanese::N2',
			modelName: 'Basic',
			fields: { Front: '診察', Back: 'medical examination' },
			tags: ['vocabulary'],
		});
		expect(result).toBe(1698765432109);
		expect(sentBody()).toEqual({
			action: 'addNote',
			version: 6,
			params: {
				note: {
					deckName: 'Japanese::N2',
					modelName: 'Basic',
					fields: { Front: '診察', Back: 'medical examination' },
					tags: ['vocabulary'],
				},
			},
		});
	});

	it('addNote defaults tags to an empty array when omitted', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: 1, error: null }));
		await client().addNote({ deckName: 'Deck', modelName: 'Model', fields: {} });
		const body = sentBody() as { params: { note: { tags: string[] } } };
		expect(body.params.note.tags).toEqual([]);
	});

	it('updateNoteFields sends noteId + fields and resolves void', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: null, error: null }));
		await expect(client().updateNoteFields(123, { Front: 'x' })).resolves.toBeUndefined();
		expect(sentBody()).toEqual({
			action: 'updateNoteFields',
			version: 6,
			params: { note: { id: 123, fields: { Front: 'x' } } },
		});
	});

	it('deleteNotes sends the noteIds array and resolves void', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: null, error: null }));
		await expect(client().deleteNotes([1, 2, 3])).resolves.toBeUndefined();
		expect(sentBody()).toEqual({
			action: 'deleteNotes',
			version: 6,
			params: { notes: [1, 2, 3] },
		});
	});

	it('deckNames resolves the returned string array', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: ['Default', 'Japanese::N2'], error: null }));
		await expect(client().deckNames()).resolves.toEqual(['Default', 'Japanese::N2']);
	});

	it('modelNames resolves the returned string array', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: ['Basic'], error: null }));
		await expect(client().modelNames()).resolves.toEqual(['Basic']);
	});

	it('modelFieldNames sends modelName and resolves the returned string array', async () => {
		requestUrl.mockResolvedValue(jsonResponse({ result: ['Front', 'Back'], error: null }));
		await expect(client().modelFieldNames('Basic')).resolves.toEqual(['Front', 'Back']);
		expect(sentBody()).toEqual({
			action: 'modelFieldNames',
			version: 6,
			params: { modelName: 'Basic' },
		});
	});
});
