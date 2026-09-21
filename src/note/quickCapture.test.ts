import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	type AnkiBridgeSettings,
	type Profile,
} from '../settings';
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

const { revealSidebarView } = vi.hoisted(() => ({
	revealSidebarView: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../ui/sidebarView', () => ({ revealSidebarView }));

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

// Settings whose active (and only) profile has the given values.
function withProfile(profile: Partial<Profile>): Partial<AnkiBridgeSettings> {
	return {
		profiles: [{ ...DEFAULT_SETTINGS.profiles[0]!, ...profile }],
	};
}

function fakeSettings(
	overrides: Partial<AnkiBridgeSettings> = {},
): AnkiBridgeSettings {
	return {
		ankiConnectUrl: '',
		profiles: DEFAULT_SETTINGS.profiles,
		activeProfileId: DEFAULT_SETTINGS.activeProfileId,
		generateWithAiFields: {},
		textProviders: [],
		activeTextProviderId: '',
		imageProviders: [],
		activeImageProviderId: '',
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
	const {
		view = null,
		existingPaths = [],
		settings: overrides = {},
	} = options;
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
	it("uses the active profile's Deck/Model/Folder", () => {
		const settings = fakeSettings({
			profiles: [
				{
					id: 'a',
					name: 'A',
					deck: 'Other',
					model: 'Other model',
					folder: '',
				},
				{
					id: 'b',
					name: 'B',
					deck: 'Japanese',
					model: 'Basic',
					folder: 'Vocab',
				},
			],
			activeProfileId: 'b',
		});

		expect(resolveQuickCaptureTarget(settings)).toEqual({
			deck: 'Japanese',
			model: 'Basic',
			folder: 'Vocab',
		});
	});

	it('returns null when the active profile has no Deck/Model', () => {
		expect(resolveQuickCaptureTarget(fakeSettings())).toBeNull();
	});

	it('returns null when the active profile has only a Deck', () => {
		expect(
			resolveQuickCaptureTarget(
				fakeSettings(withProfile({ deck: 'Japanese' })),
			),
		).toBeNull();
	});

	it('returns null when the active profile has only a Model', () => {
		expect(
			resolveQuickCaptureTarget(
				fakeSettings(withProfile({ model: 'Basic' })),
			),
		).toBeNull();
	});
});

describe('getUniqueNotePath', () => {
	it('returns the original path when there is no collision', () => {
		const app = fakeVaultApp([]);

		expect(getUniqueNotePath(app, 'Vocab', 'word.md')).toBe(
			'Vocab/word.md',
		);
	});

	it('appends a numeric suffix on a single collision', () => {
		const app = fakeVaultApp(['Vocab/word.md']);

		expect(getUniqueNotePath(app, 'Vocab', 'word.md')).toBe(
			'Vocab/word 1.md',
		);
	});

	it('increments the suffix past multiple collisions', () => {
		const app = fakeVaultApp(['Vocab/word.md', 'Vocab/word 1.md']);

		expect(getUniqueNotePath(app, 'Vocab', 'word.md')).toBe(
			'Vocab/word 2.md',
		);
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
				settings: withProfile({
					deck: 'Japanese',
					model: 'Basic',
					folder: 'Vocab',
				}),
			});

		await runQuickCapture(plugin);

		expect(vaultCreate).toHaveBeenCalledWith(
			'Vocab/薬.md',
			'## Word\n\n薬\n\n## Meaning\n',
		);
		expect(writeAnkiFrontmatter).toHaveBeenCalledWith(
			plugin.app,
			createdFile,
			{
				anki_deck: 'Japanese',
				anki_model: 'Basic',
			},
		);
		expect(openFile).toHaveBeenCalledWith(createdFile);
		expect(saveSettings).not.toHaveBeenCalled();
		expect(revealSidebarView).toHaveBeenCalledWith(plugin.app);
	});

	it('shows an error toast and does nothing else when there is no active markdown note', async () => {
		const { plugin, vaultCreate } = fakePlugin({ view: null });

		await runQuickCapture(plugin);

		expect(toastError).toHaveBeenCalledWith(
			'❌ No active markdown note to capture from.',
		);
		expect(vaultCreate).not.toHaveBeenCalled();
	});

	it('shows a Notice and opens plugin settings when the active profile has no Deck/Model', async () => {
		const { plugin, settingOpen, openTabById, vaultCreate } = fakePlugin({
			view: { editor: { getSelection: () => '薬' } },
		});

		await runQuickCapture(plugin);

		expect(Notice).toHaveBeenCalledWith(
			'Please set up a profile in Settings first',
		);
		expect(settingOpen).toHaveBeenCalled();
		expect(openTabById).toHaveBeenCalledWith('anki-bridge');
		expect(vaultCreate).not.toHaveBeenCalled();
	});

	it('shows a generic error toast when the AnkiConnect call fails', async () => {
		modelFieldNamesMock.mockRejectedValue(new Error('boom'));
		const { plugin, vaultCreate } = fakePlugin({
			view: { editor: { getSelection: () => '薬' } },
			settings: withProfile({ deck: 'Japanese', model: 'Basic' }),
		});

		await runQuickCapture(plugin);

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to create note. Please check Anki connection.',
		);
		expect(vaultCreate).not.toHaveBeenCalled();
	});
});
