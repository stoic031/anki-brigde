import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import type { AnkiBridgeSettings } from '../settings';
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
	private clickCb: (() => unknown) | null = null;

	setButtonText(t: string) {
		this.text = t;
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

class FakeSetting {
	name = '';
	dropdownComponents: FakeDropdownComponent[] = [];
	buttonComponents: FakeButtonComponent[] = [];

	constructor(public containerEl: unknown) {}
	setName(n: string) {
		this.name = n;
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
}

const { ItemView, contentElEmpty, contentElCreateEl, settings } = vi.hoisted(() => {
	const contentElEmpty = vi.fn();
	const contentElCreateEl = vi.fn();
	const settings: FakeSetting[] = [];
	class ItemView {
		contentEl = { empty: contentElEmpty, createEl: contentElCreateEl };
		constructor(public leaf: unknown) {}
	}
	return { ItemView, contentElEmpty, contentElCreateEl, settings };
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
}));

const { deckNamesMock, modelNamesMock, AnkiConnectClient } = vi.hoisted(() => {
	const deckNamesMock = vi.fn().mockResolvedValue([]);
	const modelNamesMock = vi.fn().mockResolvedValue([]);
	class AnkiConnectClient {
		deckNames = deckNamesMock;
		modelNames = modelNamesMock;
	}
	return { deckNamesMock, modelNamesMock, AnkiConnectClient };
});
vi.mock('../sync/ankiConnect', () => ({ AnkiConnectClient }));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('./toast', () => ({ toastError }));

import {
	SidebarView,
	VIEW_TYPE_SIDEBAR,
	registerSidebarView,
	revealSidebarView,
} from './sidebarView';

afterEach(() => {
	vi.clearAllMocks();
	settings.length = 0;
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

function fakePlugin(overrides: Partial<AnkiBridgeSettings> = {}): {
	plugin: AnkiBridgePlugin;
	saveSettings: ReturnType<typeof vi.fn>;
} {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		app: {} as App,
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
		expect(dropdown?.options).toEqual({ Japanese: 'Japanese', Spanish: 'Spanish' });
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

	it('shows an error toast when loading decks fails, without throwing', async () => {
		deckNamesMock.mockRejectedValue(new Error('boom'));
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

	it('shows an error toast when loading models fails, without throwing', async () => {
		modelNamesMock.mockRejectedValue(new Error('boom'));
		const { plugin } = fakePlugin();
		const view = new SidebarView({} as WorkspaceLeaf, plugin);

		await expect(view.onOpen()).resolves.toBeUndefined();

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to load models. Please check Anki connection.',
		);
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
