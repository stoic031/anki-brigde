import { describe, expect, it, vi } from 'vitest';
import type { App, FrontMatterCache, TFile } from 'obsidian';
import { syncNote } from './syncEngine';
import type { AnkiConnectClient } from './ankiConnect';
import { AnkiConnectError, SyncError } from '../types';

const CONTENT = '## Front\n\n診察\n\n## Back\n\nmedical examination\n';
const FIELDS = { Front: '診察', Back: 'medical examination' };

function fakeApp(
	content: string,
	frontmatter: FrontMatterCache | undefined,
): { app: App; frontmatter: Record<string, unknown> } {
	const fm: Record<string, unknown> = { ...frontmatter };
	const app = {
		metadataCache: { getFileCache: () => (frontmatter ? { frontmatter: fm } : null) },
		vault: { cachedRead: async () => content },
		fileManager: {
			processFrontMatter: async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
				fn(fm);
			},
		},
	} as unknown as App;
	return { app, frontmatter: fm };
}

// Returns the spies as plain locals (not read back off `client`) so assertions like
// `expect(addNote).toHaveBeenCalledWith(...)` don't trip @typescript-eslint/unbound-method,
// which fires on `expect(client.addNote)` because AnkiConnectClient's methods are typed
// as class members.
function fakeClient(
	overrides: Partial<{
		modelFieldNames: ReturnType<typeof vi.fn>;
		addNote: ReturnType<typeof vi.fn>;
		updateNoteFields: ReturnType<typeof vi.fn>;
	}> = {},
): {
	client: AnkiConnectClient;
	modelFieldNames: ReturnType<typeof vi.fn>;
	addNote: ReturnType<typeof vi.fn>;
	updateNoteFields: ReturnType<typeof vi.fn>;
} {
	const modelFieldNames = overrides.modelFieldNames ?? vi.fn().mockResolvedValue(['Front', 'Back']);
	const addNote = overrides.addNote ?? vi.fn().mockResolvedValue(999);
	const updateNoteFields = overrides.updateNoteFields ?? vi.fn().mockResolvedValue(undefined);
	const client = { modelFieldNames, addNote, updateNoteFields } as unknown as AnkiConnectClient;
	return { client, modelFieldNames, addNote, updateNoteFields };
}

const file = {} as unknown as TFile;

describe('syncNote', () => {
	it('creates a new note when anki_note_id is absent, writes the returned id back', async () => {
		const { app, frontmatter } = fakeApp(CONTENT, { anki_deck: 'Japanese::N2', anki_model: 'Basic' });
		const { client, addNote, updateNoteFields } = fakeClient();

		await syncNote(app, file, client);

		expect(addNote).toHaveBeenCalledWith({
			deckName: 'Japanese::N2',
			modelName: 'Basic',
			fields: FIELDS,
			tags: undefined,
		});
		expect(updateNoteFields).not.toHaveBeenCalled();
		expect(frontmatter.anki_note_id).toBe(999);
	});

	it('updates an existing note by id and does not touch frontmatter', async () => {
		const { app, frontmatter } = fakeApp(CONTENT, {
			anki_note_id: 123,
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic',
		});
		const { client, addNote, updateNoteFields } = fakeClient();

		await syncNote(app, file, client);

		expect(updateNoteFields).toHaveBeenCalledWith(123, FIELDS);
		expect(addNote).not.toHaveBeenCalled();
		expect(frontmatter.anki_note_id).toBe(123);
	});

	it('recovers from a stale anki_note_id: clears it and recreates the note', async () => {
		const { app, frontmatter } = fakeApp(CONTENT, {
			anki_note_id: 123,
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic',
		});
		const { client, addNote } = fakeClient({
			updateNoteFields: vi
				.fn()
				.mockRejectedValue(new AnkiConnectError('updateNoteFields', 'Note was not found: 123')),
			addNote: vi.fn().mockResolvedValue(456),
		});

		await syncNote(app, file, client);

		expect(addNote).toHaveBeenCalledWith({
			deckName: 'Japanese::N2',
			modelName: 'Basic',
			fields: FIELDS,
			tags: undefined,
		});
		expect(frontmatter.anki_note_id).toBe(456);
	});

	describe('error paths (docs/design/01-sync.md §1.6)', () => {
		it.each([
			['unreachable', 'could not reach AnkiConnect — is Anki running?'],
			['timeout', 'timed out after 5000ms'],
		])('maps AnkiConnect %s to the offline SyncError', async (_label, ankiMessage) => {
			const { app } = fakeApp(CONTENT, { anki_deck: 'Deck', anki_model: 'Basic' });
			const { client } = fakeClient({
				modelFieldNames: vi.fn().mockRejectedValue(new AnkiConnectError('modelFieldNames', ankiMessage)),
			});
			const err = await syncNote(app, file, client).catch((e: unknown) => e);
			expect(err).toBeInstanceOf(SyncError);
			expect(err).toMatchObject({
				reason: 'offline',
				message: 'Anki is not running. Please start Anki and AnkiConnect.',
			});
		});

		it('maps a duplicate-note failure on addNote to the duplicate SyncError', async () => {
			const { app } = fakeApp(CONTENT, { anki_deck: 'Deck', anki_model: 'Basic' });
			const { client } = fakeClient({
				addNote: vi
					.fn()
					.mockRejectedValue(new AnkiConnectError('addNote', 'cannot create note because it is a duplicate')),
			});
			const err = await syncNote(app, file, client).catch((e: unknown) => e);
			expect(err).toBeInstanceOf(SyncError);
			expect(err).toMatchObject({ reason: 'duplicate', message: 'Note already exists in Anki' });
		});

		it('maps a note with no frontmatter block to the parse-error SyncError', async () => {
			const { app } = fakeApp(CONTENT, undefined);
			const { client } = fakeClient();
			const err = await syncNote(app, file, client).catch((e: unknown) => e);
			expect(err).toBeInstanceOf(SyncError);
			expect(err).toMatchObject({
				reason: 'parse-error',
				message: 'Cannot parse note content. Please check format.',
			});
		});

		it('maps a model-not-found failure to the model-not-found SyncError', async () => {
			const { app } = fakeApp(CONTENT, { anki_deck: 'Deck', anki_model: 'Ghost' });
			const { client } = fakeClient({
				modelFieldNames: vi.fn().mockRejectedValue(new AnkiConnectError('modelFieldNames', 'model was not found: Ghost')),
			});
			const err = await syncNote(app, file, client).catch((e: unknown) => e);
			expect(err).toBeInstanceOf(SyncError);
			expect(err).toMatchObject({
				reason: 'model-not-found',
				message: 'Model not found in Anki. Please select it again.',
			});
		});

		it('propagates an unrecognized AnkiConnectError unchanged instead of mislabeling it', async () => {
			const { app } = fakeApp(CONTENT, { anki_deck: 'Deck', anki_model: 'Basic' });
			const original = new AnkiConnectError('modelFieldNames', 'something unexpected happened');
			const { client } = fakeClient({ modelFieldNames: vi.fn().mockRejectedValue(original) });
			await expect(syncNote(app, file, client)).rejects.toBe(original);
		});
	});
});
