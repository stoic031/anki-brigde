import { describe, expect, it, vi } from 'vitest';
import type { App, FrontMatterCache, TFile } from 'obsidian';
import { syncNote, deleteNote, pullNote } from './syncEngine';
import type { AnkiConnectClient } from './ankiConnect';
import { AnkiConnectError, SyncError } from '../types';

const CONTENT = '## Front\n\n診察\n\n## Back\n\nmedical examination\n';
const FIELDS = { Front: '診察', Back: 'medical examination' };

function fakeApp(
	content: string,
	frontmatter: FrontMatterCache | undefined,
): { app: App; frontmatter: Record<string, unknown>; body: () => string } {
	const fm: Record<string, unknown> = { ...frontmatter };
	let current = content;
	const app = {
		metadataCache: {
			getFileCache: () => (frontmatter ? { frontmatter: fm } : null),
		},
		vault: {
			cachedRead: async () => current,
			process: async (_file: TFile, fn: (data: string) => string) => {
				current = fn(current);
				return current;
			},
		},
		fileManager: {
			processFrontMatter: async (
				_file: TFile,
				fn: (fm: Record<string, unknown>) => void,
			) => {
				fn(fm);
			},
		},
	} as unknown as App;
	return { app, frontmatter: fm, body: () => current };
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
		deleteNotes: ReturnType<typeof vi.fn>;
		noteInfo: ReturnType<typeof vi.fn>;
	}> = {},
): {
	client: AnkiConnectClient;
	modelFieldNames: ReturnType<typeof vi.fn>;
	addNote: ReturnType<typeof vi.fn>;
	updateNoteFields: ReturnType<typeof vi.fn>;
	deleteNotes: ReturnType<typeof vi.fn>;
} {
	const modelFieldNames =
		overrides.modelFieldNames ??
		vi.fn().mockResolvedValue(['Front', 'Back']);
	const addNote = overrides.addNote ?? vi.fn().mockResolvedValue(999);
	const updateNoteFields =
		overrides.updateNoteFields ?? vi.fn().mockResolvedValue(undefined);
	const deleteNotes =
		overrides.deleteNotes ?? vi.fn().mockResolvedValue(undefined);
	// By default Anki keeps what was sent, so the read-back after an update matches; before
	// any update it reports the note unchanged since the baseline (mod 100).
	const noteInfo =
		overrides.noteInfo ??
		vi.fn(async () => {
			const calls = updateNoteFields.mock.calls as [
				number,
				Record<string, string>,
			][];
			return {
				fields: calls[calls.length - 1]?.[1] ?? {},
				mod: calls.length > 0 ? 200 : 100,
			};
		});
	const client = {
		modelFieldNames,
		addNote,
		updateNoteFields,
		deleteNotes,
		noteInfo,
	} as unknown as AnkiConnectClient;
	return { client, modelFieldNames, addNote, updateNoteFields, deleteNotes };
}

const file = {} as unknown as TFile;

describe('syncNote', () => {
	it('creates a new note when anki_note_id is absent, writes the returned id back', async () => {
		const { app, frontmatter } = fakeApp(CONTENT, {
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic',
		});
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
				.mockRejectedValue(
					new AnkiConnectError(
						'updateNoteFields',
						'Note was not found: 123',
					),
				),
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
		])(
			'maps AnkiConnect %s to the offline SyncError',
			async (_label, ankiMessage) => {
				const { app } = fakeApp(CONTENT, {
					anki_deck: 'Deck',
					anki_model: 'Basic',
				});
				const { client } = fakeClient({
					modelFieldNames: vi
						.fn()
						.mockRejectedValue(
							new AnkiConnectError(
								'modelFieldNames',
								ankiMessage,
							),
						),
				});
				const err = await syncNote(app, file, client).catch(
					(e: unknown) => e,
				);
				expect(err).toBeInstanceOf(SyncError);
				expect(err).toMatchObject({
					reason: 'offline',
					message:
						'Anki is not running. Please start Anki and AnkiConnect.',
				});
			},
		);

		it('maps a duplicate-note failure on addNote to the duplicate SyncError', async () => {
			const { app } = fakeApp(CONTENT, {
				anki_deck: 'Deck',
				anki_model: 'Basic',
			});
			const { client } = fakeClient({
				addNote: vi
					.fn()
					.mockRejectedValue(
						new AnkiConnectError(
							'addNote',
							'cannot create note because it is a duplicate',
						),
					),
			});
			const err = await syncNote(app, file, client).catch(
				(e: unknown) => e,
			);
			expect(err).toBeInstanceOf(SyncError);
			expect(err).toMatchObject({
				reason: 'duplicate',
				message: 'Note already exists in Anki',
			});
		});

		it('maps a note with no frontmatter block to the parse-error SyncError', async () => {
			const { app } = fakeApp(CONTENT, undefined);
			const { client } = fakeClient();
			const err = await syncNote(app, file, client).catch(
				(e: unknown) => e,
			);
			expect(err).toBeInstanceOf(SyncError);
			expect(err).toMatchObject({
				reason: 'parse-error',
				message: 'Cannot parse note content. Please check format.',
			});
		});

		it('maps a model-not-found failure to the model-not-found SyncError', async () => {
			const { app } = fakeApp(CONTENT, {
				anki_deck: 'Deck',
				anki_model: 'Ghost',
			});
			const { client } = fakeClient({
				modelFieldNames: vi
					.fn()
					.mockRejectedValue(
						new AnkiConnectError(
							'modelFieldNames',
							'model was not found: Ghost',
						),
					),
			});
			const err = await syncNote(app, file, client).catch(
				(e: unknown) => e,
			);
			expect(err).toBeInstanceOf(SyncError);
			expect(err).toMatchObject({
				reason: 'model-not-found',
				message: 'Model not found in Anki. Please select it again.',
			});
		});

		it('propagates an unrecognized AnkiConnectError unchanged instead of mislabeling it', async () => {
			const { app } = fakeApp(CONTENT, {
				anki_deck: 'Deck',
				anki_model: 'Basic',
			});
			const original = new AnkiConnectError(
				'modelFieldNames',
				'something unexpected happened',
			);
			const { client } = fakeClient({
				modelFieldNames: vi.fn().mockRejectedValue(original),
			});
			await expect(syncNote(app, file, client)).rejects.toBe(original);
		});
	});
});

describe('deleteNote', () => {
	it('deletes the note in Anki and clears anki_note_id from frontmatter', async () => {
		const { app, frontmatter } = fakeApp(CONTENT, {
			anki_note_id: 123,
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic',
		});
		const { client, deleteNotes } = fakeClient();

		await deleteNote(app, file, client);

		expect(deleteNotes).toHaveBeenCalledWith([123]);
		expect(frontmatter.anki_note_id).toBeUndefined();
	});

	it('maps a note with no anki_note_id to the parse-error SyncError, without calling deleteNotes', async () => {
		const { app } = fakeApp(CONTENT, {
			anki_deck: 'Deck',
			anki_model: 'Basic',
		});
		const { client, deleteNotes } = fakeClient();

		const err = await deleteNote(app, file, client).catch(
			(e: unknown) => e,
		);

		expect(err).toBeInstanceOf(SyncError);
		expect(err).toMatchObject({
			reason: 'parse-error',
			message: 'Cannot parse note content. Please check format.',
		});
		expect(deleteNotes).not.toHaveBeenCalled();
	});

	it('maps a note with no frontmatter block to the parse-error SyncError', async () => {
		const { app } = fakeApp(CONTENT, undefined);
		const { client } = fakeClient();

		const err = await deleteNote(app, file, client).catch(
			(e: unknown) => e,
		);

		expect(err).toBeInstanceOf(SyncError);
		expect(err).toMatchObject({
			reason: 'parse-error',
			message: 'Cannot parse note content. Please check format.',
		});
	});

	it('maps an AnkiConnect offline failure on deleteNotes to the offline SyncError', async () => {
		const { app } = fakeApp(CONTENT, {
			anki_note_id: 123,
			anki_deck: 'Deck',
			anki_model: 'Basic',
		});
		const { client } = fakeClient({
			deleteNotes: vi
				.fn()
				.mockRejectedValue(
					new AnkiConnectError(
						'deleteNotes',
						'could not reach AnkiConnect — is Anki running?',
					),
				),
		});

		const err = await deleteNote(app, file, client).catch(
			(e: unknown) => e,
		);

		expect(err).toBeInstanceOf(SyncError);
		expect(err).toMatchObject({
			reason: 'offline',
			message: 'Anki is not running. Please start Anki and AnkiConnect.',
		});
	});

	it('propagates an unrecognized AnkiConnectError unchanged instead of mislabeling it', async () => {
		const { app } = fakeApp(CONTENT, {
			anki_note_id: 123,
			anki_deck: 'Deck',
			anki_model: 'Basic',
		});
		const original = new AnkiConnectError(
			'deleteNotes',
			'something unexpected happened',
		);
		const { client } = fakeClient({
			deleteNotes: vi.fn().mockRejectedValue(original),
		});

		await expect(deleteNote(app, file, client)).rejects.toBe(original);
	});
});

describe('syncNote read-back after update', () => {
	it('fails with stale-editor when Anki kept the old field values', async () => {
		const { app } = fakeApp(CONTENT, {
			anki_deck: 'D',
			anki_model: 'M',
			anki_note_id: 42,
			anki_mod: 5,
		});
		const { client } = fakeClient({
			noteInfo: vi
				.fn()
				.mockResolvedValue({
					fields: { Front: '診察', Back: '' },
					mod: 5,
				}),
		});
		const err = await syncNote(app, {} as TFile, client).catch(
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(SyncError);
		expect((err as SyncError).reason).toBe('stale-editor');
	});

	it('succeeds when the stored values match, ignoring surrounding whitespace', async () => {
		const { app } = fakeApp(CONTENT, {
			anki_deck: 'D',
			anki_model: 'M',
			anki_note_id: 42,
		});
		const { client, updateNoteFields } = fakeClient({
			noteInfo: vi
				.fn()
				.mockResolvedValue({
					fields: { Front: ' 診察', Back: 'medical examination\n' },
					mod: 5,
				}),
		});
		await expect(
			syncNote(app, {} as TFile, client),
		).resolves.toBeUndefined();
		expect(updateNoteFields).toHaveBeenCalledWith(42, FIELDS);
	});
});

describe('syncNote Anki-edit detection (docs/design/01-sync.md §1.1)', () => {
	const synced = {
		anki_note_id: 42,
		anki_deck: 'D',
		anki_model: 'Basic',
		anki_mod: 100,
	};
	const ankiInfo = (fields: Record<string, string>, mod: number) =>
		vi
			.fn()
			.mockResolvedValueOnce({ fields, mod })
			.mockResolvedValue({ fields: FIELDS, mod: mod + 1 });

	it('throws anki-edited without writing when Anki changed since the baseline', async () => {
		const { app, frontmatter } = fakeApp(CONTENT, synced);
		const { client, updateNoteFields } = fakeClient({
			noteInfo: ankiInfo({ Front: '診察', Back: 'edited in Anki' }, 150),
		});
		const err = await syncNote(app, file, client).catch((e: unknown) => e);
		expect(err).toMatchObject({
			reason: 'anki-edited',
			message: 'This note was edited in Anki since the last sync.',
		});
		expect(updateNoteFields).not.toHaveBeenCalled();
		expect(frontmatter.anki_mod).toBe(100);
	});

	it('updates normally when Anki changed but already holds the same fields', async () => {
		const { app } = fakeApp(CONTENT, synced);
		const { client, updateNoteFields } = fakeClient({
			noteInfo: ankiInfo(FIELDS, 150),
		});
		await syncNote(app, file, client);
		expect(updateNoteFields).toHaveBeenCalledWith(42, FIELDS);
	});

	it('updates when fields differ but Anki is unchanged since the baseline', async () => {
		const { app, frontmatter } = fakeApp(CONTENT, synced);
		const { client, updateNoteFields } = fakeClient({
			noteInfo: ankiInfo({ Front: 'old', Back: '' }, 100),
		});
		await syncNote(app, file, client);
		expect(updateNoteFields).toHaveBeenCalledWith(42, FIELDS);
		expect(frontmatter.anki_mod).toBe(101);
	});

	it('treats a note with no anki_mod baseline and different fields as edited', async () => {
		const { app } = fakeApp(CONTENT, {
			anki_note_id: 42,
			anki_deck: 'D',
			anki_model: 'Basic',
		});
		const { client } = fakeClient({
			noteInfo: ankiInfo({ Front: 'old', Back: '' }, 1),
		});
		await expect(syncNote(app, file, client)).rejects.toMatchObject({
			reason: 'anki-edited',
		});
	});

	it('pushes anyway with force', async () => {
		const { app } = fakeApp(CONTENT, synced);
		// With force there is no pre-check read: the only notesInfo call is the read-back.
		const noteInfo = vi
			.fn()
			.mockResolvedValue({ fields: FIELDS, mod: 150 });
		const { client, updateNoteFields } = fakeClient({ noteInfo });
		await syncNote(app, file, client, { force: true });
		expect(updateNoteFields).toHaveBeenCalledWith(42, FIELDS);
		expect(noteInfo).toHaveBeenCalledTimes(1);
	});

	it('writes anki_mod after creating a note', async () => {
		const { app, frontmatter } = fakeApp(CONTENT, {
			anki_deck: 'D',
			anki_model: 'Basic',
		});
		const { client } = fakeClient({
			noteInfo: vi.fn().mockResolvedValue({ fields: FIELDS, mod: 77 }),
		});
		await syncNote(app, file, client);
		expect(frontmatter).toMatchObject({ anki_note_id: 999, anki_mod: 77 });
	});
});

describe('pullNote', () => {
	const LIST =
		'## Front\n\n診察\n\n## Back\n\n- one\n- two\n\n## Notes\n\nkeep me\n';

	it('replaces mapped sections with Anki fields, keeps lists as lists, writes anki_mod', async () => {
		const { app, frontmatter, body } = fakeApp(LIST, {
			anki_note_id: 42,
			anki_deck: 'D',
			anki_model: 'Basic',
		});
		const { client } = fakeClient({
			noteInfo: vi
				.fn()
				.mockResolvedValue({
					fields: { Front: '診察&nbsp;室', Back: 'a<br>b' },
					mod: 300,
				}),
		});
		await expect(pullNote(app, file, client)).resolves.toBeUndefined();
		expect(body()).toBe(
			'## Front\n\n診察 室\n\n## Back\n\n- a\n- b\n\n## Notes\n\nkeep me\n',
		);
		expect(frontmatter.anki_mod).toBe(300);
	});

	it('warns about Anki fields with no section instead of dropping them silently', async () => {
		const { app } = fakeApp('## Front\n\nx\n', {
			anki_note_id: 42,
			anki_deck: 'D',
			anki_model: 'Basic',
		});
		const { client } = fakeClient({
			noteInfo: vi
				.fn()
				.mockResolvedValue({
					fields: { Front: 'y', Back: 'lost?' },
					mod: 1,
				}),
		});
		await expect(pullNote(app, file, client)).resolves.toBe(
			'1 Anki field has no section in this note: Back',
		);
	});

	it('fails with note-not-found when the Anki note is gone, leaving the note untouched', async () => {
		const { app, body } = fakeApp(CONTENT, {
			anki_note_id: 42,
			anki_deck: 'D',
			anki_model: 'Basic',
		});
		const { client } = fakeClient({
			noteInfo: vi.fn().mockResolvedValue({ fields: {}, mod: 0 }),
		});
		await expect(pullNote(app, file, client)).rejects.toMatchObject({
			reason: 'note-not-found',
		});
		expect(body()).toBe(CONTENT);
	});
});
