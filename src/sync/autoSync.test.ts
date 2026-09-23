import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_SETTINGS, type AnkiBridgeSettings } from '../settings';

vi.mock('obsidian', () => ({ TFile: class FakeTFile {} }));

const { readAnkiFrontmatter } = vi.hoisted(() => ({
	readAnkiFrontmatter: vi.fn(),
}));
vi.mock('./parser', () => ({ readAnkiFrontmatter }));

const { syncNote } = vi.hoisted(() => ({ syncNote: vi.fn() }));
vi.mock('./syncEngine', () => ({ syncNote }));

const { AnkiConnectClient } = vi.hoisted(() => ({
	AnkiConnectClient: class {},
}));
vi.mock('./ankiConnect', () => ({ AnkiConnectClient }));

const { toastSuccess, toastError } = vi.hoisted(() => ({
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));
vi.mock('../ui/toast', () => ({ toastSuccess, toastError }));

import { TFile } from 'obsidian';
import { SyncError } from '../types';
import { registerAutoSync } from './autoSync';

function fakeTFile(overrides: Record<string, unknown> = {}): TFile {
	return Object.assign(
		Object.create(TFile.prototype) as TFile,
		{ path: 'note.md', extension: 'md' },
		overrides,
	);
}

function fakePlugin(overrides: Partial<AnkiBridgeSettings> = {}) {
	const handlers: ((file: TFile) => void)[] = [];
	const getActiveFile = vi.fn<() => TFile | null>();
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, autoSyncOnSave: true, ...overrides },
		registerEvent: vi.fn(),
		app: {
			vault: {
				on: (name: string, cb: (file: TFile) => void) => {
					if (name !== 'modify') throw new Error(name);
					handlers.push(cb);
					return cb;
				},
			},
			workspace: { getActiveFile },
		},
	} as unknown as AnkiBridgePlugin;
	return {
		plugin,
		getActiveFile,
		fireModify: (file: TFile) => handlers.forEach((h) => h(file)),
	};
}

const configured = { anki_deck: 'Deck', anki_model: 'Basic' };

beforeEach(() => {
	vi.useFakeTimers();
	// autoSync.ts ticks with window.setTimeout/clearTimeout; Node has no `window`.
	vi.stubGlobal('window', globalThis);
	readAnkiFrontmatter.mockReturnValue(configured);
	syncNote.mockReset().mockResolvedValue(undefined);
	toastSuccess.mockClear();
	toastError.mockClear();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('registerAutoSync', () => {
	it('does nothing when the setting is off', async () => {
		const { plugin, getActiveFile, fireModify } = fakePlugin({
			autoSyncOnSave: false,
		});
		const file = fakeTFile();
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		await vi.advanceTimersByTimeAsync(3000);

		expect(syncNote).not.toHaveBeenCalled();
	});

	it('ignores a non-markdown file', async () => {
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		const file = fakeTFile({ extension: 'png' });
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		await vi.advanceTimersByTimeAsync(3000);

		expect(syncNote).not.toHaveBeenCalled();
	});

	it('ignores a file that is not the active one', async () => {
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		getActiveFile.mockReturnValue(fakeTFile({ path: 'other.md' }));
		registerAutoSync(plugin);

		fireModify(fakeTFile());
		await vi.advanceTimersByTimeAsync(3000);

		expect(syncNote).not.toHaveBeenCalled();
	});

	it('debounces rapid saves of the same file into one sync', async () => {
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		const file = fakeTFile();
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		await vi.advanceTimersByTimeAsync(1000);
		fireModify(file);
		await vi.advanceTimersByTimeAsync(1000);
		fireModify(file);
		await vi.advanceTimersByTimeAsync(2000);

		expect(syncNote).toHaveBeenCalledTimes(1);
	});

	it('skips silently when the note has no Deck/Model configured', async () => {
		readAnkiFrontmatter.mockReturnValue({ anki_deck: '', anki_model: '' });
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		const file = fakeTFile();
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		await vi.advanceTimersByTimeAsync(2000);

		expect(syncNote).not.toHaveBeenCalled();
		expect(toastError).not.toHaveBeenCalled();
	});

	it('skips a file that stopped being active during the debounce window', async () => {
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		const file = fakeTFile();
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		getActiveFile.mockReturnValue(fakeTFile({ path: 'other.md' }));
		await vi.advanceTimersByTimeAsync(2000);

		expect(syncNote).not.toHaveBeenCalled();
	});

	it('does not overlap a sync already in flight for the same file', async () => {
		let resolveSync: (() => void) | undefined;
		syncNote.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveSync = resolve;
				}),
		);
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		const file = fakeTFile();
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		await vi.advanceTimersByTimeAsync(2000);
		fireModify(file);
		await vi.advanceTimersByTimeAsync(2000);

		expect(syncNote).toHaveBeenCalledTimes(1);
		resolveSync?.();
	});

	it('toasts success after a sync', async () => {
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		const file = fakeTFile();
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		await vi.advanceTimersByTimeAsync(2000);

		expect(toastSuccess).toHaveBeenCalledWith('✅ Note synced to Anki!');
	});

	it('toasts the SyncError message on a known failure', async () => {
		syncNote.mockRejectedValue(new SyncError('offline', 'Anki is not running.'));
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		const file = fakeTFile();
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		await vi.advanceTimersByTimeAsync(2000);

		expect(toastError).toHaveBeenCalledWith('❌ Anki is not running.');
		expect(toastSuccess).not.toHaveBeenCalled();
	});

	it('falls back to a generic error toast for anything else', async () => {
		syncNote.mockRejectedValue(new Error('boom'));
		const { plugin, getActiveFile, fireModify } = fakePlugin();
		const file = fakeTFile();
		getActiveFile.mockReturnValue(file);
		registerAutoSync(plugin);

		fireModify(file);
		await vi.advanceTimersByTimeAsync(2000);

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to sync. Please check Anki connection.',
		);
	});
});
