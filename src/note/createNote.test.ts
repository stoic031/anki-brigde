import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type AnkiBridgeSettings } from '../settings';
import { DEFAULT_MEDIA_PREFIX } from '../utils/constants';
import type AnkiBridgePlugin from '../main';

const { Notice } = vi.hoisted(() => ({ Notice: vi.fn() }));
vi.mock('obsidian', () => ({ Notice }));

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

const {
	resolveQuickCaptureTarget,
	resolveMainField,
	getUniqueNotePath,
	openPluginSettings,
} = vi.hoisted(() => ({
	resolveQuickCaptureTarget: vi.fn(),
	resolveMainField: vi.fn().mockResolvedValue(''),
	getUniqueNotePath: vi.fn(),
	openPluginSettings: vi.fn(),
}));
vi.mock('./quickCapture', () => ({
	resolveQuickCaptureTarget,
	resolveMainField,
	getUniqueNotePath,
	openPluginSettings,
}));

const { NoteNameModal, submitNoteName, resetCapturedSubmit } = vi.hoisted(
	() => {
		let capturedSubmit: ((name: string | null) => void) | null = null;
		class NoteNameModal {
			constructor(
				public app: unknown,
				onSubmit: (name: string | null) => void,
			) {
				capturedSubmit = onSubmit;
			}
			open() {}
		}
		return {
			NoteNameModal,
			// runCreateNote may `await` before constructing the modal, so wait for
			// capturedSubmit to actually exist rather than racing it.
			submitNoteName: async (name: string | null) => {
				while (!capturedSubmit) {
					await new Promise((resolve) => setTimeout(resolve, 0));
				}
				capturedSubmit(name);
			},
			resetCapturedSubmit: () => {
				capturedSubmit = null;
			},
		};
	},
);
vi.mock('../ui/modals/noteNameModal', () => ({ NoteNameModal }));

import { runCreateNote } from './createNote';

afterEach(() => {
	vi.clearAllMocks();
	resetCapturedSubmit();
});

function fakeSettings(
	overrides: Partial<AnkiBridgeSettings> = {},
): AnkiBridgeSettings {
	return {
		ankiConnectUrl: '',
		profiles: DEFAULT_SETTINGS.profiles,
		activeProfileId: DEFAULT_SETTINGS.activeProfileId,
		generateWithAiFields: {},
		imageConfigs: {},
		mainFieldConfig: {},
		generateExamples: {},
		textProviders: [],
		activeTextProviderId: '',
		imageProviders: [],
		activeImageProviderId: '',
		mediaPrefix: DEFAULT_MEDIA_PREFIX,
		autoSyncOnSave: false,
		nativeLanguage: '',
		...overrides,
	};
}

function fakePlugin(settingsOverrides: Partial<AnkiBridgeSettings> = {}) {
	const settings = fakeSettings(settingsOverrides);
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const createdFile = { path: 'created' };
	const vaultCreate = vi.fn().mockResolvedValue(createdFile);
	const openFile = vi.fn().mockResolvedValue(undefined);

	const plugin = {
		app: {
			vault: { create: vaultCreate },
			workspace: { getLeaf: vi.fn().mockReturnValue({ openFile }) },
		},
		settings,
		saveSettings,
		manifest: { id: 'anki-bridge' },
	} as unknown as AnkiBridgePlugin;

	return { plugin, saveSettings, vaultCreate, openFile, createdFile };
}

describe('runCreateNote', () => {
	it('creates the note after resolving a target and prompting for a name', async () => {
		resolveQuickCaptureTarget.mockReturnValue({
			deck: 'Japanese',
			model: 'Basic',
			folder: 'Vocab',
		});
		getUniqueNotePath.mockReturnValue('Vocab/word.md');
		modelFieldNamesMock.mockResolvedValue(['Word', 'Meaning']);
		const { plugin, saveSettings, vaultCreate, openFile, createdFile } =
			fakePlugin();

		const promise = runCreateNote(plugin);
		await submitNoteName('word');
		await promise;

		expect(getUniqueNotePath).toHaveBeenCalledWith(
			plugin.app,
			'Vocab',
			'word.md',
		);
		expect(vaultCreate).toHaveBeenCalledWith(
			'Vocab/word.md',
			'## Word\n\n## Meaning\n',
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
		expect(revealSidebarView).toHaveBeenCalledWith(plugin.app);
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it('pre-fills the Main Field section with whatever resolveMainField resolves to', async () => {
		resolveQuickCaptureTarget.mockReturnValue({
			deck: 'Japanese',
			model: 'Basic',
			folder: 'Vocab',
			mainField: 'Word',
		});
		resolveMainField.mockResolvedValue('Word');
		getUniqueNotePath.mockReturnValue('Vocab/word.md');
		modelFieldNamesMock.mockResolvedValue(['Word', 'Meaning']);
		const { plugin, vaultCreate } = fakePlugin();

		const promise = runCreateNote(plugin);
		await submitNoteName('word');
		await promise;

		expect(resolveMainField).toHaveBeenCalledWith(
			plugin,
			resolveQuickCaptureTarget.mock.results[0]?.value,
		);
		expect(vaultCreate).toHaveBeenCalledWith(
			'Vocab/word.md',
			'## Word\n\nword\n\n## Meaning\n',
		);
	});

	it('creates the note with nothing prefilled when resolveMainField resolves to empty', async () => {
		resolveQuickCaptureTarget.mockReturnValue({
			deck: 'Japanese',
			model: 'Basic',
			folder: 'Vocab',
			mainField: '',
		});
		resolveMainField.mockResolvedValue('');
		getUniqueNotePath.mockReturnValue('Vocab/word.md');
		modelFieldNamesMock.mockResolvedValue(['Word', 'Meaning']);
		const { plugin, vaultCreate } = fakePlugin();

		const promise = runCreateNote(plugin);
		await submitNoteName('word');
		await promise;

		expect(vaultCreate).toHaveBeenCalledWith(
			'Vocab/word.md',
			'## Word\n\n## Meaning\n',
		);
	});

	it('shows a Notice and opens plugin settings when the active profile has no Deck/Model', async () => {
		resolveQuickCaptureTarget.mockReturnValue(null);
		const { plugin, vaultCreate } = fakePlugin();

		await runCreateNote(plugin);

		expect(Notice).toHaveBeenCalledWith(
			'Please set up a profile in Settings first',
		);
		expect(openPluginSettings).toHaveBeenCalledWith(
			plugin.app,
			'anki-bridge',
		);
		expect(vaultCreate).not.toHaveBeenCalled();
	});

	it('creates nothing when the name prompt is cancelled', async () => {
		resolveQuickCaptureTarget.mockReturnValue({
			deck: 'Japanese',
			model: 'Basic',
			folder: '',
		});
		const { plugin, vaultCreate } = fakePlugin();

		const promise = runCreateNote(plugin);
		await submitNoteName(null);
		await promise;

		expect(vaultCreate).not.toHaveBeenCalled();
	});

	it('shows a generic error toast when the AnkiConnect call fails', async () => {
		resolveQuickCaptureTarget.mockReturnValue({
			deck: 'Japanese',
			model: 'Basic',
			folder: '',
		});
		getUniqueNotePath.mockReturnValue('word.md');
		modelFieldNamesMock.mockRejectedValue(new Error('boom'));
		const { plugin, vaultCreate } = fakePlugin();

		const promise = runCreateNote(plugin);
		await submitNoteName('word');
		await promise;

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to create note. Please check Anki connection.',
		);
		expect(vaultCreate).not.toHaveBeenCalled();
	});
});
