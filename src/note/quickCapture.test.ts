import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import type { AnkiBridgeSettings } from '../settings';
import type AnkiBridgePlugin from '../main';

const { MarkdownView, Notice } = vi.hoisted(() => ({
	MarkdownView: class FakeMarkdownView {},
	Notice: vi.fn(),
}));
vi.mock('obsidian', () => ({ MarkdownView, Notice }));

const { modelFieldNamesMock, AnkiConnectClient } = vi.hoisted(() => {
	const modelFieldNamesMock = vi.fn();
	class AnkiConnectClient {
		modelFieldNames = modelFieldNamesMock;
	}
	return { modelFieldNamesMock, AnkiConnectClient };
});
vi.mock('../sync/ankiConnect', () => ({ AnkiConnectClient }));

const { writeAnkiFrontmatter } = vi.hoisted(() => ({
	writeAnkiFrontmatter: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../sync/parser', () => ({ writeAnkiFrontmatter }));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('../ui/toast', () => ({ toastError }));

import {
	getQuickCaptureFilename,
	getSelectedText,
	getUniqueNotePath,
	resolveQuickCaptureTarget,
	runQuickCapture,
} from './quickCapture';

afterEach(() => {
	vi.clearAllMocks();
});

function fakeSettings(
	overrides: Partial<AnkiBridgeSettings> = {},
): AnkiBridgeSettings {
	return {
		ankiConnectUrl: '',
		defaultDeck: '',
		defaultModel: '',
		currentDeck: '',
		currentModel: '',
		currentFolder: '',
		...overrides,
	};
}

function fakeApp(view: { editor: { getSelection: () => string } } | null): App {
	return {
		workspace: { getActiveViewOfType: vi.fn().mockReturnValue(view) },
	} as unknown as App;
}

function fakeVaultApp(existingPaths: string[]): App {
	return {
		vault: {
			getAbstractFileByPath: vi.fn(
				(path: string) => existingPaths.includes(path) || null,
			),
		},
	} as unknown as App;
}

function fakePlugin(
	options: {
		view?: { editor: { getSelection: () => string } } | null;
		existingPaths?: string[];
		settings?: Partial<AnkiBridgeSettings>;
	} = {},
) {
	const { view = null, existingPaths = [], settings: overrides = {} } = options;
	const settings = fakeSettings(overrides);
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const createdFile = { path: 'created' };
	const vaultCreate = vi.fn().mockResolvedValue(createdFile);
	const openFile = vi.fn().mockResolvedValue(undefined);
	const settingOpen = vi.fn();
	const openTabById = vi.fn();

	const plugin = {
		app: {
			workspace: {
				getActiveViewOfType: vi.fn().mockReturnValue(view),
				getLeaf: vi.fn().mockReturnValue({ openFile }),
			},
			vault: {
				getAbstractFileByPath: vi.fn(
					(path: string) => existingPaths.includes(path) || null,
				),
				create: vaultCreate,
			},
			setting: { open: settingOpen, openTabById },
		},
		settings,
		saveSettings,
		manifest: { id: 'anki-bridge' },
	} as unknown as AnkiBridgePlugin;

	return {
		plugin,
		saveSettings,
		vaultCreate,
		openFile,
		settingOpen,
		openTabById,
		createdFile,
	};
}

describe('getSelectedText', () => {
	it('returns the editor selection when a markdown note is active', () => {
		const app = fakeApp({ editor: { getSelection: () => '薬' } });

		expect(getSelectedText(app)).toBe('薬');
	});

	it('returns an empty string when nothing is selected', () => {
		const app = fakeApp({ editor: { getSelection: () => '' } });

		expect(getSelectedText(app)).toBe('');
	});

	it('returns null when there is no active markdown note', () => {
		const app = fakeApp(null);

		expect(getSelectedText(app)).toBeNull();
	});
});

describe('getQuickCaptureFilename', () => {
	it('appends .md to the sanitized selected text', () => {
		expect(getQuickCaptureFilename('薬')).toBe('薬.md');
	});

	it('falls back to note.md when the selection is empty', () => {
		expect(getQuickCaptureFilename('')).toBe('note.md');
	});

	it('sanitizes path separators and whitespace before appending .md', () => {
		expect(getQuickCaptureFilename('a/b c')).toBe('ab_c.md');
	});
});

describe('resolveQuickCaptureTarget', () => {
	it('Branch A: uses the current Deck/Model/Folder when already set', () => {
		const settings = fakeSettings({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
			currentFolder: 'Vocab',
			defaultDeck: 'Other',
			defaultModel: 'Other model',
		});

		expect(resolveQuickCaptureTarget(settings)).toEqual({
			deck: 'Japanese',
			model: 'Basic',
			folder: 'Vocab',
			seededFromDefaults: false,
		});
	});

	it('Branch B: falls back to Settings Tab defaults when current is unset', () => {
		const settings = fakeSettings({
			defaultDeck: 'Japanese',
			defaultModel: 'Basic',
			currentFolder: 'Vocab',
		});

		expect(resolveQuickCaptureTarget(settings)).toEqual({
			deck: 'Japanese',
			model: 'Basic',
			folder: 'Vocab',
			seededFromDefaults: true,
		});
	});

	it('returns null when neither current nor default Deck/Model are set', () => {
		expect(resolveQuickCaptureTarget(fakeSettings())).toBeNull();
	});
});

describe('getUniqueNotePath', () => {
	it('returns the original path when there is no collision', () => {
		const app = fakeVaultApp([]);

		expect(getUniqueNotePath(app, 'Vocab', 'word.md')).toBe('Vocab/word.md');
	});

	it('appends a numeric suffix on a single collision', () => {
		const app = fakeVaultApp(['Vocab/word.md']);

		expect(getUniqueNotePath(app, 'Vocab', 'word.md')).toBe('Vocab/word 1.md');
	});

	it('increments the suffix past multiple collisions', () => {
		const app = fakeVaultApp(['Vocab/word.md', 'Vocab/word 1.md']);

		expect(getUniqueNotePath(app, 'Vocab', 'word.md')).toBe('Vocab/word 2.md');
	});

	it('has no folder prefix when the folder is the vault root', () => {
		const app = fakeVaultApp([]);

		expect(getUniqueNotePath(app, '', 'word.md')).toBe('word.md');
	});
});

describe('runQuickCapture', () => {
	it('creates the note with the skeleton, prefilled first field, and frontmatter, then opens it', async () => {
		modelFieldNamesMock.mockResolvedValue(['Word', 'Meaning']);
		const { plugin, saveSettings, vaultCreate, openFile, createdFile } =
			fakePlugin({
				view: { editor: { getSelection: () => '薬' } },
				settings: {
					currentDeck: 'Japanese',
					currentModel: 'Basic',
					currentFolder: 'Vocab',
				},
			});

		await runQuickCapture(plugin);

		expect(vaultCreate).toHaveBeenCalledWith(
			'Vocab/薬.md',
			'```anki-controls\n```\n\n## Word\n\n薬\n\n## Meaning\n',
		);
		expect(writeAnkiFrontmatter).toHaveBeenCalledWith(plugin.app, createdFile, {
			anki_deck: 'Japanese',
			anki_model: 'Basic',
		});
		expect(openFile).toHaveBeenCalledWith(createdFile);
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it('persists the seeded Deck/Model when falling back to Settings Tab defaults', async () => {
		modelFieldNamesMock.mockResolvedValue(['Word']);
		const { plugin, saveSettings } = fakePlugin({
			view: { editor: { getSelection: () => '薬' } },
			settings: { defaultDeck: 'Japanese', defaultModel: 'Basic' },
		});

		await runQuickCapture(plugin);

		expect(saveSettings).toHaveBeenCalled();
		expect(plugin.settings.currentDeck).toBe('Japanese');
		expect(plugin.settings.currentModel).toBe('Basic');
	});

	it('shows an error toast and does nothing else when there is no active markdown note', async () => {
		const { plugin, vaultCreate } = fakePlugin({ view: null });

		await runQuickCapture(plugin);

		expect(toastError).toHaveBeenCalledWith(
			'❌ No active markdown note to capture from.',
		);
		expect(vaultCreate).not.toHaveBeenCalled();
	});

	it('shows a Notice and opens plugin settings when neither current nor default Deck/Model are set', async () => {
		const { plugin, settingOpen, openTabById, vaultCreate } = fakePlugin({
			view: { editor: { getSelection: () => '薬' } },
		});

		await runQuickCapture(plugin);

		expect(Notice).toHaveBeenCalledWith(
			'Please configure Deck, Model, and Save location in Settings first',
		);
		expect(settingOpen).toHaveBeenCalled();
		expect(openTabById).toHaveBeenCalledWith('anki-bridge');
		expect(vaultCreate).not.toHaveBeenCalled();
	});

	it('shows a generic error toast when the AnkiConnect call fails', async () => {
		modelFieldNamesMock.mockRejectedValue(new Error('boom'));
		const { plugin, vaultCreate } = fakePlugin({
			view: { editor: { getSelection: () => '薬' } },
			settings: { currentDeck: 'Japanese', currentModel: 'Basic' },
		});

		await runQuickCapture(plugin);

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to create note. Please check Anki connection.',
		);
		expect(vaultCreate).not.toHaveBeenCalled();
	});
});
