import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import { fieldConfigKey, type AnkiBridgeSettings } from '../settings';
import type AnkiBridgePlugin from '../main';

class FakeDropdownComponent {
	options: Record<string, string> = {};
	optionOrder: string[] = [];
	value = '';
	selectEl: { empty: () => void };
	private changeCb: ((v: string) => unknown) | null = null;

	constructor() {
		this.selectEl = {
			empty: () => {
				this.options = {};
				this.optionOrder = [];
			},
		};
	}
	addOption(value: string, display: string) {
		this.options[value] = display;
		this.optionOrder.push(value);
		return this;
	}
	setValue(v: string) {
		this.value = v;
		return this;
	}
	onChange(cb: (v: string) => unknown) {
		this.changeCb = cb;
		return this;
	}
	async triggerChange(v: string) {
		this.value = v;
		await this.changeCb?.(v);
	}
}

class FakeButtonComponent {
	text = '';
	disabled = false;
	private clickCb: (() => unknown) | null = null;

	setButtonText(t: string) {
		this.text = t;
		return this;
	}
	setDisabled(d: boolean) {
		this.disabled = d;
		return this;
	}
	onClick(cb: () => unknown) {
		this.clickCb = cb;
		return this;
	}
	async triggerClick() {
		await this.clickCb?.();
	}
}

class FakeToggleComponent {
	value = false;
	private changeCb: ((v: boolean) => unknown) | null = null;

	setValue(v: boolean) {
		this.value = v;
		return this;
	}
	onChange(cb: (v: boolean) => unknown) {
		this.changeCb = cb;
		return this;
	}
	async triggerChange(v: boolean) {
		this.value = v;
		await this.changeCb?.(v);
	}
}

class FakeSetting {
	name = '';
	desc = '';
	dropdownComponents: FakeDropdownComponent[] = [];
	buttonComponents: FakeButtonComponent[] = [];
	toggleComponents: FakeToggleComponent[] = [];

	constructor(public containerEl: unknown) {}
	setName(n: string) {
		this.name = n;
		return this;
	}
	setDesc(d: string) {
		this.desc = d;
		return this;
	}
	addDropdown(cb: (d: FakeDropdownComponent) => unknown) {
		const dropdown = new FakeDropdownComponent();
		cb(dropdown);
		this.dropdownComponents.push(dropdown);
		return this;
	}
	addButton(cb: (b: FakeButtonComponent) => unknown) {
		const button = new FakeButtonComponent();
		cb(button);
		this.buttonComponents.push(button);
		return this;
	}
	addToggle(cb: (t: FakeToggleComponent) => unknown) {
		const toggle = new FakeToggleComponent();
		cb(toggle);
		this.toggleComponents.push(toggle);
		return this;
	}
}

const {
	ItemView,
	contentElEmpty,
	contentElCreateEl,
	fieldsContainerEl,
	settings,
} = vi.hoisted(() => {
	const contentElEmpty = vi.fn();
	const contentElCreateEl = vi.fn();
	const fieldsContainerEl = { empty: vi.fn(), createEl: vi.fn() };
	const contentElCreateDiv = vi.fn().mockReturnValue(fieldsContainerEl);
	const settings: FakeSetting[] = [];
	class ItemView {
		contentEl = {
			empty: contentElEmpty,
			createEl: contentElCreateEl,
			createDiv: contentElCreateDiv,
		};
		constructor(public leaf: unknown) {}
	}
	return {
		ItemView,
		contentElEmpty,
		contentElCreateEl,
		fieldsContainerEl,
		settings,
	};
});
vi.mock('obsidian', () => ({
	ItemView,
	Setting: class {
		constructor(containerEl: unknown) {
			const s = new FakeSetting(containerEl);
			settings.push(s);
			return s;
		}
	},
	TFile: class FakeTFile {},
}));

const {
	deckNamesMock,
	modelNamesMock,
	modelFieldNamesMock,
	versionMock,
	AnkiConnectClient,
} = vi.hoisted(() => {
	const deckNamesMock = vi.fn().mockResolvedValue([]);
	const modelNamesMock = vi.fn().mockResolvedValue([]);
	const modelFieldNamesMock = vi.fn().mockResolvedValue([]);
	const versionMock = vi.fn().mockResolvedValue(6);
	class AnkiConnectClient {
		deckNames = deckNamesMock;
		modelNames = modelNamesMock;
		modelFieldNames = modelFieldNamesMock;
		version = versionMock;
	}
	return {
		deckNamesMock,
		modelNamesMock,
		modelFieldNamesMock,
		versionMock,
		AnkiConnectClient,
	};
});
vi.mock('../sync/ankiConnect', () => ({ AnkiConnectClient }));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('./toast', () => ({ toastError }));

const { deckModelWarningOpen, deckModelWarningCapture } = vi.hoisted(() => ({
	deckModelWarningOpen: vi.fn(),
	deckModelWarningCapture: {
		onKeepOld: undefined as (() => void) | undefined,
		onUpdate: undefined as (() => void) | undefined,
	},
}));
vi.mock('./modals/deckModelChangeWarning', () => ({
	DeckModelChangeWarningModal: class {
		constructor(
			_app: unknown,
			onKeepOld: () => void,
			onUpdate: () => void,
		) {
			deckModelWarningCapture.onKeepOld = onKeepOld;
			deckModelWarningCapture.onUpdate = onUpdate;
		}
		open = deckModelWarningOpen;
	},
}));

import { TFile } from 'obsidian';
import {
	SidebarView,
	VIEW_TYPE_SIDEBAR,
	registerSidebarView,
	revealSidebarView,
} from './sidebarView';

afterEach(() => {
	vi.clearAllMocks();
	settings.length = 0;
	deckModelWarningCapture.onKeepOld = undefined;
	deckModelWarningCapture.onUpdate = undefined;
});

function fakeSettings(
	overrides: Partial<AnkiBridgeSettings> = {},
): AnkiBridgeSettings {
	return {
		ankiConnectUrl: '',
		defaultDeck: '',
		defaultModel: '',
		defaultFolder: '',
		currentDeck: '',
		currentModel: '',
		currentFolder: '',
		generateWithAiFields: {},
		...overrides,
	};
}

interface FakeFolder {
	path: string;
	name: string;
	parent: FakeFolder | null;
	isRoot: () => boolean;
}

// parent defaults to null (= vault root), matching how flat, non-nested test folders
// behave today: buildFolderTreeEntries() groups by `folder.parent?.path ?? ''`, and
// root's path is '' either way. Pass an explicit parent to build nested fixtures.
function fakeFolder(path: string, parent: FakeFolder | null = null): FakeFolder {
	return {
		path,
		name: path === '' ? '' : (path.split('/').pop() ?? path),
		parent,
		isRoot: () => path === '',
	};
}

function fakeApp(
	options: {
		folders?: FakeFolder[];
		activeFileParent?: FakeFolder | null;
		activeFile?: object | null;
		frontmatter?: Record<string, unknown> | null;
	} = {},
): { app: App; getAllFolders: ReturnType<typeof vi.fn> } {
	const {
		folders = [fakeFolder('')],
		activeFileParent = null,
		activeFile,
		frontmatter = null,
	} = options;
	const resolvedActiveFile =
		activeFile !== undefined
			? activeFile
			: activeFileParent === null
				? null
				: { parent: activeFileParent };
	const getAllFolders = vi.fn().mockReturnValue(folders);
	const app = {
		vault: { getAllFolders },
		workspace: {
			getActiveFile: vi.fn().mockReturnValue(resolvedActiveFile),
		},
		metadataCache: {
			getFileCache: vi
				.fn()
				.mockReturnValue(frontmatter ? { frontmatter } : null),
		},
	} as unknown as App;
	return { app, getAllFolders };
}

function fakeTFile(overrides: Record<string, unknown> = {}): TFile {
	return Object.assign(
		Object.create(TFile.prototype) as TFile,
		overrides,
	);
}

function fakePlugin(
	overrides: Partial<AnkiBridgeSettings> = {},
	appOptions: Parameters<typeof fakeApp>[0] = {},
): {
	plugin: AnkiBridgePlugin;
	saveSettings: ReturnType<typeof vi.fn>;
	getAllFolders: ReturnType<typeof vi.fn>;
} {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const { app, getAllFolders } = fakeApp(appOptions);
	const plugin = {
		app,
		settings: fakeSettings(overrides),
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	return { plugin, saveSettings, getAllFolders };
}

// Setting row order in Tab 1: Connection Status (0), Deck (1), Model (2), Folder (3),
// Fields (4+, only once Deck+Model are both set).
const STATUS_IDX = 0;
const DECK_IDX = 1;
const MODEL_IDX = 2;
const FOLDER_IDX = 3;

describe('SidebarView', () => {
	it('reports its view type', () => {
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		expect(view.getViewType()).toBe(VIEW_TYPE_SIDEBAR);
	});

	it('has a display text and icon', () => {
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		expect(view.getDisplayText()).toBe('Anki Bridge');
		expect(view.getIcon()).toBeTruthy();
	});

	it('renders the Connection Status row first, before Deck/Model/Folder, without throwing', async () => {
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await expect(view.onOpen()).resolves.toBeUndefined();
		expect(contentElEmpty).toHaveBeenCalled();
		expect(contentElCreateEl).toHaveBeenCalledWith('h4', {
			text: 'Anki Bridge',
		});
		expect(settings[STATUS_IDX]?.name).toContain('Status:');
		expect(settings[DECK_IDX]?.name).toBe('Deck');
		expect(settings[MODEL_IDX]?.name).toBe('Model');
		expect(settings[FOLDER_IDX]?.name).toBe('Save notes to');
	});

	it('populates the Deck dropdown and pre-selects the saved current deck', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const { plugin } = fakePlugin({ currentDeck: 'Spanish' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const dropdown = settings[DECK_IDX]?.dropdownComponents[0];
		expect(dropdown?.options).toEqual({
			Japanese: 'Japanese',
			Spanish: 'Spanish',
		});
		expect(dropdown?.value).toBe('Spanish');
	});

	it('does not pre-select a saved deck that no longer exists', async () => {
		deckNamesMock.mockResolvedValue(['Japanese']);
		const { plugin } = fakePlugin({ currentDeck: 'Deleted deck' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[DECK_IDX]?.dropdownComponents[0]?.value).toBe('');
	});

	it('persists the selected deck to settings.currentDeck', async () => {
		deckNamesMock.mockResolvedValue(['Japanese']);
		const { plugin, saveSettings } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		await settings[DECK_IDX]?.dropdownComponents[0]?.triggerChange('Japanese');

		expect(plugin.settings.currentDeck).toBe('Japanese');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('has no Refresh button of its own on the Deck row', async () => {
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[DECK_IDX]?.buttonComponents).toHaveLength(0);
	});

	it('shows an error toast when loading decks fails, without throwing', async () => {
		deckNamesMock.mockRejectedValueOnce(new Error('boom'));
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await expect(view.onOpen()).resolves.toBeUndefined();

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to load decks. Please check Anki connection.',
		);
	});

	it('populates the Model dropdown and pre-selects the saved current model', async () => {
		modelNamesMock.mockResolvedValue(['Basic', 'Cloze']);
		const { plugin } = fakePlugin({ currentModel: 'Cloze' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const dropdown = settings[MODEL_IDX]?.dropdownComponents[0];
		expect(dropdown?.options).toEqual({ Basic: 'Basic', Cloze: 'Cloze' });
		expect(dropdown?.value).toBe('Cloze');
	});

	it('does not pre-select a saved model that no longer exists', async () => {
		modelNamesMock.mockResolvedValue(['Basic']);
		const { plugin } = fakePlugin({ currentModel: 'Deleted model' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[MODEL_IDX]?.dropdownComponents[0]?.value).toBe('');
	});

	it('persists the selected model to settings.currentModel', async () => {
		modelNamesMock.mockResolvedValue(['Basic']);
		const { plugin, saveSettings } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		await settings[MODEL_IDX]?.dropdownComponents[0]?.triggerChange('Basic');

		expect(plugin.settings.currentModel).toBe('Basic');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('has no Refresh button of its own on the Model row', async () => {
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[MODEL_IDX]?.buttonComponents).toHaveLength(0);
	});

	it('shows an error toast when loading models fails, without throwing', async () => {
		modelNamesMock.mockRejectedValueOnce(new Error('boom'));
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await expect(view.onOpen()).resolves.toBeUndefined();

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to load models. Please check Anki connection.',
		);
	});

	it('renders the Folder dropdown on open, with no Refresh button of its own', async () => {
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[FOLDER_IDX]?.name).toBe('Save notes to');
		expect(settings[FOLDER_IDX]?.buttonComponents).toHaveLength(0);
	});

	it('populates the Folder dropdown with vault root plus top-level vault folders', async () => {
		const { plugin } = fakePlugin(
			{},
			{
				folders: [
					fakeFolder(''),
					fakeFolder('Japanese'),
					fakeFolder('Spanish'),
				],
			},
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[FOLDER_IDX]?.dropdownComponents[0]?.options).toEqual({
			'': '/ (vault root)',
			Japanese: 'Japanese',
			Spanish: 'Spanish',
		});
	});

	it('pre-selects the saved currentFolder when it still exists', async () => {
		const { plugin } = fakePlugin(
			{ currentFolder: 'Japanese' },
			{ folders: [fakeFolder(''), fakeFolder('Japanese')] },
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[FOLDER_IDX]?.dropdownComponents[0]?.value).toBe('Japanese');
	});

	it('falls back to the active file folder when currentFolder is unset, and persists it', async () => {
		const { plugin, saveSettings } = fakePlugin(
			{ currentFolder: '' },
			{
				folders: [fakeFolder(''), fakeFolder('Japanese')],
				activeFileParent: fakeFolder('Japanese'),
			},
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[FOLDER_IDX]?.dropdownComponents[0]?.value).toBe('Japanese');
		expect(plugin.settings.currentFolder).toBe('Japanese');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('falls back to vault root when currentFolder is unset and there is no active file', async () => {
		const { plugin } = fakePlugin(
			{ currentFolder: '' },
			{
				folders: [fakeFolder(''), fakeFolder('Japanese')],
				activeFileParent: null,
			},
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[FOLDER_IDX]?.dropdownComponents[0]?.value).toBe('');
		expect(plugin.settings.currentFolder).toBe('');
	});

	it('falls back to the active file folder when the saved currentFolder no longer exists', async () => {
		const { plugin } = fakePlugin(
			{ currentFolder: 'Deleted folder' },
			{
				folders: [fakeFolder(''), fakeFolder('Spanish')],
				activeFileParent: fakeFolder('Spanish'),
			},
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[FOLDER_IDX]?.dropdownComponents[0]?.value).toBe('Spanish');
		expect(plugin.settings.currentFolder).toBe('Spanish');
	});

	it('persists the selected folder to settings.currentFolder onChange', async () => {
		const { plugin, saveSettings } = fakePlugin(
			{},
			{ folders: [fakeFolder(''), fakeFolder('Japanese')] },
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		saveSettings.mockClear();
		await settings[FOLDER_IDX]?.dropdownComponents[0]?.triggerChange('Japanese');

		expect(plugin.settings.currentFolder).toBe('Japanese');
		expect(saveSettings).toHaveBeenCalled();
	});

	describe('nested folder display', () => {
		const INDENT = '  ';

		it('indents nested folders by depth and shows only each folder’s own name', async () => {
			const japanese = fakeFolder('Japanese');
			const n2 = fakeFolder('Japanese/N2', japanese);
			const vocab = fakeFolder('Japanese/N2/Vocab', n2);
			const { plugin } = fakePlugin(
				{},
				{ folders: [fakeFolder(''), japanese, n2, vocab] },
			);
			const view = new SidebarView({} as WorkspaceLeaf, plugin);

			await view.onOpen();

			const dropdown = settings[FOLDER_IDX]?.dropdownComponents[0];
			expect(dropdown?.options).toEqual({
				'': '/ (vault root)',
				'Japanese': 'Japanese',
				'Japanese/N2': `${INDENT}N2`,
				'Japanese/N2/Vocab': `${INDENT}${INDENT}Vocab`,
			});
		});

		it('walks the tree depth-first: each folder immediately followed by its own children', async () => {
			const japanese = fakeFolder('Japanese');
			const n2 = fakeFolder('Japanese/N2', japanese);
			const vocab = fakeFolder('Japanese/N2/Vocab', n2);
			const korean = fakeFolder('Korean');
			const { plugin } = fakePlugin(
				{},
				// Deliberately out of order as returned from the vault.
				{ folders: [fakeFolder(''), korean, vocab, japanese, n2] },
			);
			const view = new SidebarView({} as WorkspaceLeaf, plugin);

			await view.onOpen();

			expect(
				settings[FOLDER_IDX]?.dropdownComponents[0]?.optionOrder,
			).toEqual(['', 'Japanese', 'Japanese/N2', 'Japanese/N2/Vocab', 'Korean']);
		});

		it('sorts sibling folders by their own name, not full path', async () => {
			const japanese = fakeFolder('Japanese');
			const zebra = fakeFolder('Japanese/Zebra', japanese);
			const apple = fakeFolder('Japanese/Apple', japanese);
			const { plugin } = fakePlugin(
				{},
				{ folders: [fakeFolder(''), japanese, zebra, apple] },
			);
			const view = new SidebarView({} as WorkspaceLeaf, plugin);

			await view.onOpen();

			expect(
				settings[FOLDER_IDX]?.dropdownComponents[0]?.optionOrder,
			).toEqual(['', 'Japanese', 'Japanese/Apple', 'Japanese/Zebra']);
		});

		it('does not let a sibling folder wedge between a parent and its own child (path-string sort bug)', async () => {
			// "Japanese Advanced" (space, 0x20) sorts before "Japanese/N2" (slash,
			// 0x2F) under plain path-string comparison, even though Japanese/N2 is a
			// child of the unrelated "Japanese" folder. Grouping by actual
			// TFolder.parent (not path strings) must keep Japanese/N2 directly under
			// Japanese regardless of what other top-level folders exist.
			const japanese = fakeFolder('Japanese');
			const japaneseAdvanced = fakeFolder('Japanese Advanced');
			const n2 = fakeFolder('Japanese/N2', japanese);
			const { plugin } = fakePlugin(
				{},
				{ folders: [fakeFolder(''), japaneseAdvanced, japanese, n2] },
			);
			const view = new SidebarView({} as WorkspaceLeaf, plugin);

			await view.onOpen();

			expect(
				settings[FOLDER_IDX]?.dropdownComponents[0]?.optionOrder,
			).toEqual(['', 'Japanese', 'Japanese/N2', 'Japanese Advanced']);
		});
	});

	it('does not render field checkboxes until Deck and Model are both selected', async () => {
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: '',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(modelFieldNamesMock).not.toHaveBeenCalled();
		expect(settings).toHaveLength(4); // Connection status, Deck, Model, Folder
		expect(fieldsContainerEl.empty).toHaveBeenCalled();
	});

	it('renders a toggle per model field once Deck and Model are selected', async () => {
		modelFieldNamesMock.mockResolvedValue(['Meaning', 'Furigana']);
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(modelFieldNamesMock).toHaveBeenCalledWith('Basic');
		expect(fieldsContainerEl.createEl).toHaveBeenCalledWith('p', {
			text: 'Fields to generate with AI:',
		});
		expect(settings[4]?.name).toBe('Meaning');
		expect(settings[5]?.name).toBe('Furigana');
	});

	it('pre-ticks fields previously selected for that Deck+Model pair', async () => {
		modelFieldNamesMock.mockResolvedValue(['Meaning', 'Furigana']);
		const key = fieldConfigKey('Japanese', 'Basic');
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
			generateWithAiFields: { [key]: ['Furigana'] },
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[4]?.toggleComponents[0]?.value).toBe(false);
		expect(settings[5]?.toggleComponents[0]?.value).toBe(true);
	});

	it('does not leak ticked fields from a different Deck+Model pair', async () => {
		modelFieldNamesMock.mockResolvedValue(['Meaning']);
		const otherKey = fieldConfigKey('Spanish', 'Cloze');
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
			generateWithAiFields: { [otherKey]: ['Meaning'] },
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[4]?.toggleComponents[0]?.value).toBe(false);
	});

	it('persists a ticked field to generateWithAiFields for the current Deck+Model pair', async () => {
		modelFieldNamesMock.mockResolvedValue(['Meaning', 'Furigana']);
		const { plugin, saveSettings } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		saveSettings.mockClear();
		await settings[4]?.toggleComponents[0]?.triggerChange(true);

		const key = fieldConfigKey('Japanese', 'Basic');
		expect(plugin.settings.generateWithAiFields[key]).toEqual(['Meaning']);
		expect(saveSettings).toHaveBeenCalled();
	});

	it('removes a field from generateWithAiFields when unticked', async () => {
		modelFieldNamesMock.mockResolvedValue(['Meaning', 'Furigana']);
		const key = fieldConfigKey('Japanese', 'Basic');
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
			generateWithAiFields: { [key]: ['Meaning', 'Furigana'] },
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		await settings[4]?.toggleComponents[0]?.triggerChange(false);

		expect(plugin.settings.generateWithAiFields[key]).toEqual(['Furigana']);
	});

	it('re-fetches and re-renders field checkboxes when the Deck dropdown changes', async () => {
		modelFieldNamesMock.mockResolvedValueOnce(['Meaning']);
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		modelFieldNamesMock.mockResolvedValueOnce(['Meaning', 'Furigana']);
		await settings[DECK_IDX]?.dropdownComponents[0]?.triggerChange('Spanish');

		expect(plugin.settings.currentDeck).toBe('Spanish');
		expect(modelFieldNamesMock).toHaveBeenCalledTimes(2);
		expect(settings.slice(-2).map((s) => s.name)).toEqual([
			'Meaning',
			'Furigana',
		]);
	});

	it('re-fetches and re-renders field checkboxes when the Model dropdown changes', async () => {
		modelFieldNamesMock.mockResolvedValueOnce(['Meaning']);
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		modelFieldNamesMock.mockResolvedValueOnce(['Front', 'Back']);
		await settings[MODEL_IDX]?.dropdownComponents[0]?.triggerChange('Cloze');

		expect(plugin.settings.currentModel).toBe('Cloze');
		expect(modelFieldNamesMock).toHaveBeenCalledTimes(2);
		expect(settings.slice(-2).map((s) => s.name)).toEqual([
			'Front',
			'Back',
		]);
	});

	it('shows an error toast when loading fields fails, without throwing', async () => {
		modelFieldNamesMock.mockRejectedValueOnce(new Error('boom'));
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await expect(view.onOpen()).resolves.toBeUndefined();

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to load fields. Please check Anki connection.',
		);
	});

	it('renders the connection status with the resolved AnkiConnect URL and an icon-only 🔄 button', async () => {
		const { plugin } = fakePlugin({ ankiConnectUrl: 'http://localhost:9999' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const statusSetting = settings[STATUS_IDX];
		expect(statusSetting?.desc).toBe('AnkiConnect: http://localhost:9999');
		expect(statusSetting?.buttonComponents[0]?.text).toBe('🔄');
	});

	it('uses the default AnkiConnect URL in the description when the setting is blank', async () => {
		const { plugin } = fakePlugin({ ankiConnectUrl: '' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const statusSetting = settings[STATUS_IDX];
		expect(statusSetting?.desc).toBe('AnkiConnect: http://localhost:8765');
	});

	it('shows Connected after a successful auto-test on open', async () => {
		versionMock.mockResolvedValue(6);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const statusSetting = settings[STATUS_IDX];
		expect(statusSetting?.name).toBe('Status: ✅ Connected');
	});

	it('shows a failure message after a failed auto-test on open, without a toast', async () => {
		versionMock.mockRejectedValueOnce(new Error('boom'));
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const statusSetting = settings[STATUS_IDX];
		expect(statusSetting?.name).toBe(
			'Status: ❌ Cannot connect to Anki. Please check URL and AnkiConnect.',
		);
		expect(toastError).not.toHaveBeenCalled();
	});

	it('re-tests and updates the status when 🔄 is clicked', async () => {
		versionMock.mockResolvedValueOnce(6);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		const statusSetting = settings[STATUS_IDX];
		expect(statusSetting?.name).toBe('Status: ✅ Connected');

		versionMock.mockRejectedValueOnce(new Error('boom'));
		await statusSetting?.buttonComponents[0]?.triggerClick();

		expect(statusSetting?.name).toBe(
			'Status: ❌ Cannot connect to Anki. Please check URL and AnkiConnect.',
		);
	});

	it('disables 🔄 while a click is in-flight, and re-enables it after', async () => {
		versionMock.mockResolvedValueOnce(6);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		const statusSetting = settings[STATUS_IDX];
		let resolveVersion!: (v: number) => void;
		versionMock.mockReturnValueOnce(
			new Promise<number>((resolve) => {
				resolveVersion = resolve;
			}),
		);

		const clickPromise = statusSetting?.buttonComponents[0]?.triggerClick();
		expect(statusSetting?.buttonComponents[0]?.disabled).toBe(true);

		resolveVersion(6);
		await clickPromise;

		expect(statusSetting?.buttonComponents[0]?.disabled).toBe(false);
	});

	it('reloads decks, models, fields, and folders after a successful 🔄 click', async () => {
		versionMock.mockRejectedValueOnce(new Error('Anki not running yet'));
		const { plugin, getAllFolders: getAllFoldersMock } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		deckNamesMock.mockClear();
		modelNamesMock.mockClear();
		modelFieldNamesMock.mockClear();
		getAllFoldersMock.mockClear();
		versionMock.mockResolvedValueOnce(6);

		const statusSetting = settings[STATUS_IDX];
		await statusSetting?.buttonComponents[0]?.triggerClick();

		expect(deckNamesMock).toHaveBeenCalledTimes(1);
		expect(modelNamesMock).toHaveBeenCalledTimes(1);
		expect(modelFieldNamesMock).toHaveBeenCalledTimes(1);
		expect(getAllFoldersMock).toHaveBeenCalledTimes(1);
	});

	it('still reloads folders (but not decks/models/fields) after a failed 🔄 click', async () => {
		const { plugin, getAllFolders: getAllFoldersMock } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		deckNamesMock.mockClear();
		modelNamesMock.mockClear();
		modelFieldNamesMock.mockClear();
		getAllFoldersMock.mockClear();
		versionMock.mockRejectedValueOnce(new Error('boom'));

		const statusSetting = settings[STATUS_IDX];
		await statusSetting?.buttonComponents[0]?.triggerClick();

		expect(deckNamesMock).not.toHaveBeenCalled();
		expect(modelNamesMock).not.toHaveBeenCalled();
		expect(modelFieldNamesMock).not.toHaveBeenCalled();
		expect(getAllFoldersMock).toHaveBeenCalledTimes(1);
	});

	it('does not cascade into decks/models/fields/folders a second time during the automatic check on open', async () => {
		versionMock.mockResolvedValueOnce(6);
		const { plugin, getAllFolders: getAllFoldersMock } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(deckNamesMock).toHaveBeenCalledTimes(1);
		expect(modelNamesMock).toHaveBeenCalledTimes(1);
		expect(modelFieldNamesMock).toHaveBeenCalledTimes(1);
		expect(getAllFoldersMock).toHaveBeenCalledTimes(1);
	});
});

describe('Deck/Model change warning', () => {
	it('opens the warning modal instead of applying, when the Deck dropdown changes on a synced note', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const activeFile = fakeTFile();
		const { plugin, saveSettings } = fakePlugin(
			{ currentDeck: 'Japanese' },
			{ activeFile, frontmatter: { anki_note_id: 123 } },
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();
		saveSettings.mockClear();

		await settings[DECK_IDX]?.dropdownComponents[0]?.triggerChange('Spanish');

		expect(deckModelWarningOpen).toHaveBeenCalledTimes(1);
		expect(plugin.settings.currentDeck).toBe('Japanese');
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it('opens the warning modal instead of applying, when the Model dropdown changes on a synced note', async () => {
		modelNamesMock.mockResolvedValue(['Basic', 'Cloze']);
		const activeFile = fakeTFile();
		const { plugin, saveSettings } = fakePlugin(
			{ currentModel: 'Basic' },
			{ activeFile, frontmatter: { anki_note_id: 123 } },
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();
		saveSettings.mockClear();

		await settings[MODEL_IDX]?.dropdownComponents[0]?.triggerChange('Cloze');

		expect(deckModelWarningOpen).toHaveBeenCalledTimes(1);
		expect(plugin.settings.currentModel).toBe('Basic');
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it('applies the change when the modal calls onUpdate', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const activeFile = fakeTFile();
		const { plugin, saveSettings } = fakePlugin(
			{ currentDeck: 'Japanese' },
			{ activeFile, frontmatter: { anki_note_id: 123 } },
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();
		await settings[DECK_IDX]?.dropdownComponents[0]?.triggerChange('Spanish');

		deckModelWarningCapture.onUpdate?.();
		await Promise.resolve();

		expect(plugin.settings.currentDeck).toBe('Spanish');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('reverts the dropdown to the prior value when the modal calls onKeepOld', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const activeFile = fakeTFile();
		const { plugin, saveSettings } = fakePlugin(
			{ currentDeck: 'Japanese' },
			{ activeFile, frontmatter: { anki_note_id: 123 } },
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();
		saveSettings.mockClear();
		await settings[DECK_IDX]?.dropdownComponents[0]?.triggerChange('Spanish');

		deckModelWarningCapture.onKeepOld?.();

		expect(settings[DECK_IDX]?.dropdownComponents[0]?.value).toBe('Japanese');
		expect(plugin.settings.currentDeck).toBe('Japanese');
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it('applies the change directly, without a modal, when the active file has no anki_note_id', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const activeFile = fakeTFile();
		const { plugin, saveSettings } = fakePlugin(
			{ currentDeck: 'Japanese' },
			{ activeFile, frontmatter: { anki_deck: 'Japanese' } },
		);
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		await settings[DECK_IDX]?.dropdownComponents[0]?.triggerChange('Spanish');

		expect(deckModelWarningOpen).not.toHaveBeenCalled();
		expect(plugin.settings.currentDeck).toBe('Spanish');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('applies the change directly, without a modal, when there is no active file', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const { plugin, saveSettings } = fakePlugin({ currentDeck: 'Japanese' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		await settings[DECK_IDX]?.dropdownComponents[0]?.triggerChange('Spanish');

		expect(deckModelWarningOpen).not.toHaveBeenCalled();
		expect(plugin.settings.currentDeck).toBe('Spanish');
		expect(saveSettings).toHaveBeenCalled();
	});
});

describe('registerSidebarView', () => {
	it('registers the sidebar view type with a factory function', () => {
		const registerView = vi.fn();
		const plugin = { registerView } as unknown as AnkiBridgePlugin;

		registerSidebarView(plugin);

		expect(registerView).toHaveBeenCalledWith(
			VIEW_TYPE_SIDEBAR,
			expect.any(Function),
		);
	});
});

describe('revealSidebarView', () => {
	it('reveals the existing leaf instead of creating a duplicate', async () => {
		const revealLeaf = vi.fn().mockResolvedValue(undefined);
		const getRightLeaf = vi.fn();
		const existingLeaf = {};
		const app = {
			workspace: {
				getLeavesOfType: vi.fn().mockReturnValue([existingLeaf]),
				revealLeaf,
				getRightLeaf,
			},
		} as unknown as App;

		await revealSidebarView(app);

		expect(revealLeaf).toHaveBeenCalledWith(existingLeaf);
		expect(getRightLeaf).not.toHaveBeenCalled();
	});

	it('creates and reveals a new right-sidebar leaf when none is open', async () => {
		const setViewState = vi.fn().mockResolvedValue(undefined);
		const newLeaf = { setViewState };
		const revealLeaf = vi.fn().mockResolvedValue(undefined);
		const app = {
			workspace: {
				getLeavesOfType: vi.fn().mockReturnValue([]),
				getRightLeaf: vi.fn().mockReturnValue(newLeaf),
				revealLeaf,
			},
		} as unknown as App;

		await revealSidebarView(app);

		expect(setViewState).toHaveBeenCalledWith({
			type: VIEW_TYPE_SIDEBAR,
			active: true,
		});
		expect(revealLeaf).toHaveBeenCalledWith(newLeaf);
	});

	it('does nothing when no right leaf is available', async () => {
		const revealLeaf = vi.fn();
		const app = {
			workspace: {
				getLeavesOfType: vi.fn().mockReturnValue([]),
				getRightLeaf: vi.fn().mockReturnValue(null),
				revealLeaf,
			},
		} as unknown as App;

		await revealSidebarView(app);

		expect(revealLeaf).not.toHaveBeenCalled();
	});
});
