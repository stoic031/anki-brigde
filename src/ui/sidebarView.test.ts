import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import { fieldConfigKey, type AnkiBridgeSettings } from '../settings';
import type AnkiBridgePlugin from '../main';

class FakeDropdownComponent {
	options: Record<string, string> = {};
	value = '';
	selectEl: { empty: () => void };
	private changeCb: ((v: string) => unknown) | null = null;

	constructor() {
		this.selectEl = {
			empty: () => {
				this.options = {};
			},
		};
	}
	addOption(value: string, display: string) {
		this.options[value] = display;
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
	isRoot: () => boolean;
}

function fakeFolder(path: string): FakeFolder {
	return { path, isRoot: () => path === '' };
}

function fakeApp(
	options: {
		folders?: FakeFolder[];
		activeFileParent?: FakeFolder | null;
		activeFile?: object | null;
		frontmatter?: Record<string, unknown> | null;
	} = {},
): App {
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
	return {
		vault: {
			getAllFolders: vi.fn().mockReturnValue(folders),
		},
		workspace: {
			getActiveFile: vi.fn().mockReturnValue(resolvedActiveFile),
		},
		metadataCache: {
			getFileCache: vi
				.fn()
				.mockReturnValue(frontmatter ? { frontmatter } : null),
		},
	} as unknown as App;
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
} {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		app: fakeApp(appOptions),
		settings: fakeSettings(overrides),
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	return { plugin, saveSettings };
}

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

	it('renders a placeholder and the Deck dropdown on open without throwing', async () => {
		deckNamesMock.mockResolvedValue([]);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await expect(view.onOpen()).resolves.toBeUndefined();
		expect(contentElEmpty).toHaveBeenCalled();
		expect(contentElCreateEl).toHaveBeenCalledWith('h4', {
			text: 'Anki Bridge',
		});
		expect(settings[0]?.name).toBe('Deck');
	});

	it('populates the Deck dropdown and pre-selects the saved current deck', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const { plugin } = fakePlugin({ currentDeck: 'Spanish' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const dropdown = settings[0]?.dropdownComponents[0];
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

		expect(settings[0]?.dropdownComponents[0]?.value).toBe('');
	});

	it('persists the selected deck to settings.currentDeck', async () => {
		deckNamesMock.mockResolvedValue(['Japanese']);
		const { plugin, saveSettings } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		await settings[0]?.dropdownComponents[0]?.triggerChange('Japanese');

		expect(plugin.settings.currentDeck).toBe('Japanese');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('re-fetches and repopulates when Refresh is clicked', async () => {
		deckNamesMock.mockResolvedValueOnce(['Japanese']);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		deckNamesMock.mockResolvedValueOnce(['Japanese', 'Spanish']);
		await settings[0]?.buttonComponents[0]?.triggerClick();

		expect(settings[0]?.dropdownComponents[0]?.options).toEqual({
			Japanese: 'Japanese',
			Spanish: 'Spanish',
		});
	});

	it('also reloads the Generate-with-AI fields when Deck Refresh is clicked, so a reconnect recovers them', async () => {
		deckNamesMock.mockResolvedValue(['Japanese']);
		modelFieldNamesMock.mockResolvedValueOnce(['Meaning']);
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		modelFieldNamesMock.mockResolvedValueOnce(['Meaning', 'Furigana']);
		await settings[0]?.buttonComponents[0]?.triggerClick();

		expect(modelFieldNamesMock).toHaveBeenCalledTimes(2);
		expect(settings.slice(-2).map((s) => s.name)).toEqual([
			'Meaning',
			'Furigana',
		]);
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

	it('renders the Model dropdown on open', async () => {
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[1]?.name).toBe('Model');
	});

	it('populates the Model dropdown and pre-selects the saved current model', async () => {
		modelNamesMock.mockResolvedValue(['Basic', 'Cloze']);
		const { plugin } = fakePlugin({ currentModel: 'Cloze' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const dropdown = settings[1]?.dropdownComponents[0];
		expect(dropdown?.options).toEqual({ Basic: 'Basic', Cloze: 'Cloze' });
		expect(dropdown?.value).toBe('Cloze');
	});

	it('does not pre-select a saved model that no longer exists', async () => {
		modelNamesMock.mockResolvedValue(['Basic']);
		const { plugin } = fakePlugin({ currentModel: 'Deleted model' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[1]?.dropdownComponents[0]?.value).toBe('');
	});

	it('persists the selected model to settings.currentModel', async () => {
		modelNamesMock.mockResolvedValue(['Basic']);
		const { plugin, saveSettings } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		await settings[1]?.dropdownComponents[0]?.triggerChange('Basic');

		expect(plugin.settings.currentModel).toBe('Basic');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('re-fetches and repopulates models when Refresh is clicked', async () => {
		modelNamesMock.mockResolvedValueOnce(['Basic']);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();
		modelNamesMock.mockResolvedValueOnce(['Basic', 'Cloze']);
		await settings[1]?.buttonComponents[0]?.triggerClick();

		expect(settings[1]?.dropdownComponents[0]?.options).toEqual({
			Basic: 'Basic',
			Cloze: 'Cloze',
		});
	});

	it('also reloads the Generate-with-AI fields when Model Refresh is clicked, so a reconnect recovers them', async () => {
		modelNamesMock.mockResolvedValue(['Basic']);
		modelFieldNamesMock.mockResolvedValueOnce(['Meaning']);
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		modelFieldNamesMock.mockResolvedValueOnce(['Front', 'Back']);
		await settings[1]?.buttonComponents[0]?.triggerClick();

		expect(modelFieldNamesMock).toHaveBeenCalledTimes(2);
		expect(settings.slice(-2).map((s) => s.name)).toEqual([
			'Front',
			'Back',
		]);
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

	it('renders the Folder dropdown on open, with no Refresh button', async () => {
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(settings[2]?.name).toBe('Save notes to');
		expect(settings[2]?.buttonComponents).toHaveLength(0);
	});

	it('populates the Folder dropdown with vault root plus vault folders', async () => {
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

		expect(settings[2]?.dropdownComponents[0]?.options).toEqual({
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

		expect(settings[2]?.dropdownComponents[0]?.value).toBe('Japanese');
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

		expect(settings[2]?.dropdownComponents[0]?.value).toBe('Japanese');
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

		expect(settings[2]?.dropdownComponents[0]?.value).toBe('');
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

		expect(settings[2]?.dropdownComponents[0]?.value).toBe('Spanish');
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
		await settings[2]?.dropdownComponents[0]?.triggerChange('Japanese');

		expect(plugin.settings.currentFolder).toBe('Japanese');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('does not render field checkboxes until Deck and Model are both selected', async () => {
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: '',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(modelFieldNamesMock).not.toHaveBeenCalled();
		expect(settings).toHaveLength(4); // Deck, Model, Folder, Connection status
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
		expect(settings[3]?.name).toBe('Meaning');
		expect(settings[4]?.name).toBe('Furigana');
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

		expect(settings[3]?.toggleComponents[0]?.value).toBe(false);
		expect(settings[4]?.toggleComponents[0]?.value).toBe(true);
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

		expect(settings[3]?.toggleComponents[0]?.value).toBe(false);
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
		await settings[3]?.toggleComponents[0]?.triggerChange(true);

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
		await settings[3]?.toggleComponents[0]?.triggerChange(false);

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
		await settings[0]?.dropdownComponents[0]?.triggerChange('Spanish');

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
		await settings[1]?.dropdownComponents[0]?.triggerChange('Cloze');

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

	it('renders the connection status with the resolved AnkiConnect URL and a Test connection button', async () => {
		const { plugin } = fakePlugin({ ankiConnectUrl: 'http://localhost:9999' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const statusSetting = settings[settings.length - 1];
		expect(statusSetting?.desc).toBe('AnkiConnect: http://localhost:9999');
		expect(statusSetting?.buttonComponents[0]?.text).toBe('Test connection');
	});

	it('uses the default AnkiConnect URL in the description when the setting is blank', async () => {
		const { plugin } = fakePlugin({ ankiConnectUrl: '' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const statusSetting = settings[settings.length - 1];
		expect(statusSetting?.desc).toBe('AnkiConnect: http://localhost:8765');
	});

	it('shows Connected after a successful auto-test on open', async () => {
		versionMock.mockResolvedValue(6);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const statusSetting = settings[settings.length - 1];
		expect(statusSetting?.name).toBe('Status: ✅ Connected');
	});

	it('shows a failure message after a failed auto-test on open, without a toast', async () => {
		versionMock.mockRejectedValueOnce(new Error('boom'));
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		const statusSetting = settings[settings.length - 1];
		expect(statusSetting?.name).toBe(
			'Status: ❌ Cannot connect to Anki. Please check URL and AnkiConnect.',
		);
		expect(toastError).not.toHaveBeenCalled();
	});

	it('re-tests and updates the status when Test connection is clicked', async () => {
		versionMock.mockResolvedValueOnce(6);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		const statusSetting = settings[settings.length - 1];
		expect(statusSetting?.name).toBe('Status: ✅ Connected');

		versionMock.mockRejectedValueOnce(new Error('boom'));
		await statusSetting?.buttonComponents[0]?.triggerClick();

		expect(statusSetting?.name).toBe(
			'Status: ❌ Cannot connect to Anki. Please check URL and AnkiConnect.',
		);
	});

	it('disables the Test connection button while a re-test is in-flight, and re-enables it after', async () => {
		versionMock.mockResolvedValueOnce(6);
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		const statusSetting = settings[settings.length - 1];
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

	it('reloads decks, models, and fields after a successful manual Test connection click', async () => {
		deckNamesMock.mockResolvedValueOnce([]);
		modelNamesMock.mockResolvedValueOnce([]);
		versionMock.mockRejectedValueOnce(new Error('Anki not running yet'));
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		deckNamesMock.mockClear();
		modelNamesMock.mockClear();
		modelFieldNamesMock.mockClear();
		deckNamesMock.mockResolvedValueOnce(['Japanese']);
		modelNamesMock.mockResolvedValueOnce(['Basic']);
		modelFieldNamesMock.mockResolvedValueOnce(['Meaning']);
		versionMock.mockResolvedValueOnce(6);

		const statusSetting = settings[settings.length - 1];
		await statusSetting?.buttonComponents[0]?.triggerClick();

		expect(deckNamesMock).toHaveBeenCalledTimes(1);
		expect(modelNamesMock).toHaveBeenCalledTimes(1);
		expect(modelFieldNamesMock).toHaveBeenCalledTimes(1);
	});

	it('does not reload decks, models, or fields after a failed manual Test connection click', async () => {
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		deckNamesMock.mockClear();
		modelNamesMock.mockClear();
		modelFieldNamesMock.mockClear();
		versionMock.mockRejectedValueOnce(new Error('boom'));

		const statusSetting = settings[settings.length - 1];
		await statusSetting?.buttonComponents[0]?.triggerClick();

		expect(deckNamesMock).not.toHaveBeenCalled();
		expect(modelNamesMock).not.toHaveBeenCalled();
		expect(modelFieldNamesMock).not.toHaveBeenCalled();
	});

	it('does not reload decks, models, or fields during the automatic check on open', async () => {
		versionMock.mockResolvedValueOnce(6);
		const { plugin } = fakePlugin({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
		});
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await view.onOpen();

		expect(deckNamesMock).toHaveBeenCalledTimes(1);
		expect(modelNamesMock).toHaveBeenCalledTimes(1);
		expect(modelFieldNamesMock).toHaveBeenCalledTimes(1);
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

		await settings[0]?.dropdownComponents[0]?.triggerChange('Spanish');

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

		await settings[1]?.dropdownComponents[0]?.triggerChange('Cloze');

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
		await settings[0]?.dropdownComponents[0]?.triggerChange('Spanish');

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
		await settings[0]?.dropdownComponents[0]?.triggerChange('Spanish');

		deckModelWarningCapture.onKeepOld?.();

		expect(settings[0]?.dropdownComponents[0]?.value).toBe('Japanese');
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

		await settings[0]?.dropdownComponents[0]?.triggerChange('Spanish');

		expect(deckModelWarningOpen).not.toHaveBeenCalled();
		expect(plugin.settings.currentDeck).toBe('Spanish');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('applies the change directly, without a modal, when there is no active file', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const { plugin, saveSettings } = fakePlugin({ currentDeck: 'Japanese' });
		const view = new SidebarView({} as WorkspaceLeaf, plugin);
		await view.onOpen();

		await settings[0]?.dropdownComponents[0]?.triggerChange('Spanish');

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
