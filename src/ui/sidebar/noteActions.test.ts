import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../../main';
import type { TFile } from 'obsidian';
import { FakeEl } from '../../test/fakeDom';

const { setIcon, Notice } = vi.hoisted(() => ({
	setIcon: vi.fn(),
	Notice: vi.fn(),
}));
vi.mock('obsidian', () => ({ setIcon, Notice }));

const { syncNote, deleteNote, pullNote } = vi.hoisted(() => ({
	syncNote: vi.fn(),
	deleteNote: vi.fn(),
	pullNote: vi.fn(),
}));
vi.mock('../../sync/syncEngine', () => ({ syncNote, deleteNote, pullNote }));

const { syncNoteName } = vi.hoisted(() => ({ syncNoteName: vi.fn() }));
vi.mock('../../note/noteName', () => ({ syncNoteName }));

const { modelFieldNames, AnkiConnectClient } = vi.hoisted(() => {
	const modelFieldNames = vi.fn();
	class AnkiConnectClient {
		constructor(public url: string) {}
		modelFieldNames = modelFieldNames;
	}
	return { modelFieldNames, AnkiConnectClient };
});
vi.mock('../../sync/ankiConnect', () => ({ AnkiConnectClient }));

const { toastSuccess, toastError } = vi.hoisted(() => ({
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));
vi.mock('../toast', () => ({ toastSuccess, toastError }));

// Modals capture their confirm callback so tests can "click" Confirm.
const { deleteModal, rebuildModal } = vi.hoisted(() => ({
	deleteModal: {
		onConfirm: undefined as (() => void) | undefined,
		open: vi.fn(),
	},
	rebuildModal: {
		onConfirm: undefined as (() => void) | undefined,
		open: vi.fn(),
	},
}));
vi.mock('../modals/confirm', () => ({
	DELETE_COPY: { button: 'Delete' },
	REBUILD_COPY: { button: 'Rebuild' },
	ConfirmModal: class {
		private modal: typeof deleteModal;
		constructor(
			_app: unknown,
			copy: { button: string },
			onConfirm: () => void,
		) {
			this.modal = copy.button === 'Delete' ? deleteModal : rebuildModal;
			this.modal.onConfirm = onConfirm;
		}
		open = () => {
			this.modal.open();
		};
	},
}));
const { conflictModal } = vi.hoisted(() => ({
	conflictModal: { choice: null as string | null, open: vi.fn() },
}));
vi.mock('../modals/syncConflict', () => ({
	SyncConflictModal: class {
		constructor(
			_app: unknown,
			private onChoice: (c: string | null) => void,
		) {}
		open = () => {
			conflictModal.open();
			this.onChoice(conflictModal.choice);
		};
	},
}));

import { AnkiConnectError, SyncError } from '../../types';
import { fieldConfigKey } from '../../settings';
import { renderNoteActions, type ActionState } from './noteActions';

const note = { path: 'a.md', basename: 'a' } as unknown as TFile;
const process = vi.fn(async (_f: unknown, fn: (d: string) => string) =>
	fn('---\nanki_model: Basic\n---\n\nold body\n'),
);

function setup(
	state: Partial<ActionState> = {},
	// Rebuild is gated on Main Field being configured; default it for the pair used
	// by every existing test (deck: 'Japanese', model: 'Basic') so tests that don't
	// care about the gate keep working unchanged.
	mainFieldConfig: Record<string, string> = {
		[fieldConfigKey('Japanese', 'Basic')]: 'Front',
	},
) {
	const parent = new FakeEl();
	const plugin = {
		app: { vault: { process } },
		settings: { ankiConnectUrl: 'http://localhost:1234', mainFieldConfig },
	} as unknown as AnkiBridgePlugin;
	const actions = renderNoteActions(parent as unknown as HTMLElement, plugin);
	actions.update({
		note,
		deck: 'Japanese',
		model: 'Basic',
		synced: false,
		...state,
	});
	const [sync, rebuild, del] = parent.byClass(
		'anki-bridge-sidebar__action',
	) as [FakeEl, FakeEl, FakeEl];
	const label = (b: FakeEl) => b.children[1]?.text;
	return { parent, actions, sync, rebuild, del, label };
}

beforeEach(() => {
	syncNoteName.mockResolvedValue(undefined);
	vi.useFakeTimers();
	vi.stubGlobal('window', globalThis);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	deleteModal.onConfirm = undefined;
	rebuildModal.onConfirm = undefined;
});

describe('renderNoteActions — layout and state', () => {
	it('renders Sync | Rebuild | Delete on one row, each with an icon and text', () => {
		const { parent, sync, rebuild, del, label } = setup();

		expect(parent.byClass('anki-bridge-sidebar__actions')).toHaveLength(1);
		expect([sync, rebuild, del].map(label)).toEqual([
			'Sync',
			'Rebuild',
			'Delete',
		]);
		expect(
			(setIcon.mock.calls as [unknown, string][]).map(([, name]) => name),
		).toEqual(['refresh-cw', 'hammer', 'trash-2']);
	});

	it('disables Sync and Rebuild with no active note', () => {
		const { sync, rebuild } = setup({ note: null, model: '' });

		expect(sync.disabled).toBe(true);
		expect(rebuild.disabled).toBe(true);
	});

	it('enables Sync but disables Rebuild when the note has no Model', () => {
		const { sync, rebuild } = setup({ model: '' });

		expect(sync.disabled).toBe(false);
		expect(rebuild.disabled).toBe(true);
	});

	it('shows Delete only once the note is synced, and follows later updates', () => {
		const { actions, del } = setup({ synced: false });
		expect(del.hidden).toBe(true);

		actions.update({
			note,
			deck: 'Japanese',
			model: 'Basic',
			synced: true,
		});
		expect(del.hidden).toBe(false);

		actions.update({
			note,
			deck: 'Japanese',
			model: 'Basic',
			synced: false,
		});
		expect(del.hidden).toBe(true);
	});
});

describe('Sync button', () => {
	it('shows ⏳ while working, then ✅ Done! with a success toast, then restores after 2s', async () => {
		let resolve!: () => void;
		syncNote.mockReturnValue(new Promise<void>((r) => (resolve = r)));
		const { sync, label } = setup();

		const click = sync.click();
		expect(label(sync)).toBe('⏳ Processing...');
		expect(sync.disabled).toBe(true);

		resolve();
		await click;
		await vi.advanceTimersByTimeAsync(0); // let the post-sync rename settle
		expect(label(sync)).toBe('✅ Done!');
		expect(toastSuccess).toHaveBeenCalledWith('✅ Note synced to Anki!');

		vi.advanceTimersByTime(2000);
		expect(label(sync)).toBe('Sync');
		expect(sync.disabled).toBe(false);
	});

	it('syncs the active note against the configured AnkiConnect URL', async () => {
		syncNote.mockResolvedValue(undefined);
		const { sync } = setup();

		await sync.click();

		const client = syncNote.mock.calls[0]?.[2] as { url: string };
		expect(syncNote.mock.calls[0]?.[1]).toBe(note);
		expect(client.url).toBe('http://localhost:1234');
	});

	it('renames the note to its Main Field after syncing', async () => {
		syncNote.mockResolvedValue(undefined);
		const { sync } = setup();

		await sync.click();

		expect(syncNoteName).toHaveBeenCalledWith(
			expect.anything(),
			note,
			'Front',
		);
	});

	it('shows a SyncError’s own message, then restores after 3s', async () => {
		syncNote.mockRejectedValue(
			new SyncError('model-not-found', 'Model "X" not found in Anki.'),
		);
		const { sync, label } = setup();

		await sync.click();

		expect(label(sync)).toBe('❌ Error');
		expect(toastError).toHaveBeenCalledWith(
			'❌ Model "X" not found in Anki.',
		);
		vi.advanceTimersByTime(3000);
		expect(label(sync)).toBe('Sync');
		expect(sync.disabled).toBe(false);
	});

	it('shows the generic message for any other error', async () => {
		syncNote.mockRejectedValue(new Error('boom'));
		const { sync } = setup();

		await sync.click();

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to sync. Please check Anki connection.',
		);
	});

	it('shows an unrecognized AnkiConnectError’s own message instead of the generic one', async () => {
		syncNote.mockRejectedValue(
			new AnkiConnectError('modelFieldNames', 'some Anki-side message'),
		);
		const { sync } = setup();

		await sync.click();

		expect(toastError).toHaveBeenCalledWith(
			"❌ AnkiConnect 'modelFieldNames' failed: some Anki-side message",
		);
	});

	it('does nothing when disabled (no active note)', async () => {
		const { sync } = setup({ note: null });

		await sync.click();

		expect(syncNote).not.toHaveBeenCalled();
	});

	it('is not re-enabled by a state update while it is still working', async () => {
		let resolve!: () => void;
		syncNote.mockReturnValue(new Promise<void>((r) => (resolve = r)));
		const { actions, sync } = setup();

		const click = sync.click();
		actions.update({
			note,
			deck: 'Japanese',
			model: 'Basic',
			synced: true,
		});
		expect(sync.disabled).toBe(true);

		resolve();
		await click;
	});
});

describe('Sync button — note edited in Anki', () => {
	const conflict = new SyncError(
		'anki-edited',
		'This note was edited in Anki since the last sync.',
	);

	it('Keep Obsidian version re-syncs with force', async () => {
		syncNote.mockRejectedValueOnce(conflict).mockResolvedValue(undefined);
		conflictModal.choice = 'obsidian';
		const { sync } = setup();

		await sync.click();
		await vi.advanceTimersByTimeAsync(0); // modal → re-sync/pull → rename

		expect(conflictModal.open).toHaveBeenCalledTimes(1);
		expect(syncNote.mock.calls[1]?.[3]).toEqual({ force: true });
		expect(pullNote).not.toHaveBeenCalled();
		expect(syncNoteName).toHaveBeenCalledTimes(1);
		expect(toastSuccess).toHaveBeenCalledWith('✅ Note synced to Anki!');
	});

	it('Use Anki version pulls and surfaces its warning', async () => {
		syncNote.mockRejectedValueOnce(conflict);
		pullNote.mockResolvedValue(
			'1 Anki field has no section in this note: Back',
		);
		conflictModal.choice = 'anki';
		const { sync } = setup();

		await sync.click();
		await vi.advanceTimersByTimeAsync(0); // modal → re-sync/pull → rename

		expect(pullNote.mock.calls[0]?.[1]).toBe(note);
		expect(syncNote).toHaveBeenCalledTimes(1);
		expect(toastError).toHaveBeenCalledWith(
			'⚠️ 1 Anki field has no section in this note: Back',
		);
		expect(syncNoteName).toHaveBeenCalledWith(
			expect.anything(),
			note,
			'Front',
		);
		expect(toastSuccess).toHaveBeenCalledWith('✅ Note updated from Anki!');
	});

	it('Cancel writes nothing and reports the conflict', async () => {
		syncNote.mockRejectedValueOnce(conflict);
		conflictModal.choice = null;
		const { sync, label } = setup();

		await sync.click();
		await vi.advanceTimersByTimeAsync(0); // modal → re-sync/pull → rename

		expect(syncNote).toHaveBeenCalledTimes(1);
		expect(pullNote).not.toHaveBeenCalled();
		expect(syncNoteName).not.toHaveBeenCalled();
		expect(label(sync)).toBe('❌ Error');
		expect(toastError).toHaveBeenCalledWith(
			'❌ This note was edited in Anki since the last sync.',
		);
	});
});

describe('Delete button', () => {
	it('asks for confirmation before deleting', async () => {
		const { del } = setup({ synced: true });

		await del.click();

		expect(deleteModal.open).toHaveBeenCalledTimes(1);
		expect(deleteNote).not.toHaveBeenCalled();
	});

	it('on confirm: deletes, toasts, and hides itself', async () => {
		deleteNote.mockResolvedValue(undefined);
		const { del, label } = setup({ synced: true });
		await del.click();

		deleteModal.onConfirm?.();

		await vi.waitFor(() => expect(del.hidden).toBe(true));
		expect(deleteNote.mock.calls[0]?.[1]).toBe(note);
		expect(toastSuccess).toHaveBeenCalledWith('✅ Note deleted from Anki!');
		expect(label(del)).toBe('Delete');
		expect(del.disabled).toBe(false);
	});

	it('on failure: shows the error, stays visible, and restores after 3s', async () => {
		deleteNote.mockRejectedValue(new Error('boom'));
		const { del, label } = setup({ synced: true });
		await del.click();

		deleteModal.onConfirm?.();

		await vi.waitFor(() => expect(label(del)).toBe('❌ Error'));
		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to delete. Please check Anki connection.',
		);
		expect(del.hidden).toBe(false);
		vi.advanceTimersByTime(3000);
		expect(label(del)).toBe('Delete');
		expect(del.disabled).toBe(false);
	});

	it('shows a SyncError’s own message', async () => {
		deleteNote.mockRejectedValue(
			new SyncError('offline', 'Cannot reach Anki.'),
		);
		const { del } = setup({ synced: true });
		await del.click();

		deleteModal.onConfirm?.();

		await vi.waitFor(() =>
			expect(toastError).toHaveBeenCalledWith('❌ Cannot reach Anki.'),
		);
	});
});

describe('Rebuild button', () => {
	it('asks for confirmation and does not touch the note until confirmed', async () => {
		const { rebuild } = setup();

		await rebuild.click();

		expect(rebuildModal.open).toHaveBeenCalledTimes(1);
		expect(process).not.toHaveBeenCalled();
	});

	it('on confirm: rewrites the body from the Model’s fields, keeping frontmatter, and prefills Main Field with the note title', async () => {
		modelFieldNames.mockResolvedValue(['Front', 'Back']);
		const { rebuild, label } = setup();
		await rebuild.click();

		rebuildModal.onConfirm?.();

		await vi.waitFor(() => expect(process).toHaveBeenCalledTimes(1));
		expect(modelFieldNames).toHaveBeenCalledWith('Basic');
		expect(await process.mock.results[0]?.value).toBe(
			'---\nanki_model: Basic\n---\n\n## Front\n\na\n\n## Back\n',
		);
		await vi.waitFor(() => expect(label(rebuild)).toBe('✅ Done!'));
		expect(toastSuccess).toHaveBeenCalledWith('✅ Note fields rebuilt.');
	});

	it('shows a Notice and stops, without opening the confirm modal, when Main Field is not configured', async () => {
		const { rebuild } = setup({}, {}); // no mainFieldConfig for any pair

		await rebuild.click();

		expect(Notice).toHaveBeenCalledWith(
			'Please choose a main field for this deck/model in the sidebar first.',
		);
		expect(rebuildModal.open).not.toHaveBeenCalled();
		expect(process).not.toHaveBeenCalled();
	});

	it('on failure: leaves the note alone and shows an error toast', async () => {
		modelFieldNames.mockRejectedValue(new Error('boom'));
		const { rebuild } = setup();
		await rebuild.click();

		rebuildModal.onConfirm?.();

		await vi.waitFor(() =>
			expect(toastError).toHaveBeenCalledWith(
				'❌ Failed to rebuild fields. Please check Anki connection.',
			),
		);
		expect(process).not.toHaveBeenCalled();
	});

	it('does nothing when the note has no Model', async () => {
		const { rebuild } = setup({ model: '' });

		await rebuild.click();

		expect(rebuildModal.open).not.toHaveBeenCalled();
	});
});
