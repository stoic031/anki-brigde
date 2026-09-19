import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	fieldConfigKey,
	type AnkiBridgeSettings,
	type Profile,
} from '../settings';
import { PROFILE_CHANGED_EVENT } from '../utils/constants';
import type AnkiBridgePlugin from '../main';

class FakeDropdownComponent {
	options: Record<string, string> = {};
	optionOrder: string[] = [];
	value = '';
	disabled = false;
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
	setDisabled(d: boolean) {
		this.disabled = d;
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
		registerEvent(_ref: unknown) {}
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

const { toastError, toastSuccess } = vi.hoisted(() => ({
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
}));
vi.mock('./toast', () => ({ toastError, toastSuccess }));

const { confirmRebuildOpen, confirmRebuildCapture } = vi.hoisted(() => ({
	confirmRebuildOpen: vi.fn(),
	confirmRebuildCapture: { onConfirm: undefined as (() => void) | undefined },
}));
vi.mock('./modals/confirmRebuildFields', () => ({
	ConfirmRebuildFieldsModal: class {
		constructor(_app: unknown, onConfirm: () => void) {
			confirmRebuildCapture.onConfirm = onConfirm;
		}
		open = confirmRebuildOpen;
	},
}));

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
	confirmRebuildCapture.onConfirm = undefined;
});


const profileA: Profile = {
	id: 'a',
	name: 'Japanese',
	deck: '',
	model: '',
	folder: '',
};
const profileB: Profile = { ...profileA, id: 'b', name: 'Spanish' };

function fakeSettings(
	overrides: Partial<AnkiBridgeSettings> = {},
): AnkiBridgeSettings {
	return {
		...DEFAULT_SETTINGS,
		profiles: [{ ...profileA }, { ...profileB }],
		activeProfileId: 'a',
		...overrides,
	};
}

function fakeApp(
	options: {
		activeFile?: object | null;
		frontmatter?: Record<string, unknown> | null;
	} = {},
) {
	const { activeFile = null, frontmatter = null } = options;
	const getActiveFile = vi.fn().mockReturnValue(activeFile);
	const workspaceOn = vi.fn();
	const metadataOn = vi.fn();
	const liveFrontmatter: Record<string, unknown> = { ...frontmatter };
	// Returned as plain locals (not read back off `app`) so assertions like
	// `expect(processFrontMatter).not.toHaveBeenCalled()` don't trip
	// @typescript-eslint/unbound-method.
	const processFrontMatter = vi
		.fn()
		.mockImplementation(
			async (_file: unknown, fn: (fm: Record<string, unknown>) => void) => {
				fn(liveFrontmatter);
			},
		);
	const getFileCache = vi
		.fn()
		.mockReturnValue(frontmatter ? { frontmatter } : null);
	// Runs the callback against a fixed note so tests can assert the rewritten content.
	const process = vi
		.fn()
		.mockImplementation((_file: unknown, fn: (data: string) => string) =>
			fn('---\nanki_deck: Japanese\n---\n\nold body\n'),
		);
	const app = {
		vault: { process },
		workspace: { getActiveFile, on: workspaceOn },
		metadataCache: { getFileCache, on: metadataOn },
		fileManager: { processFrontMatter },
	} as unknown as App;
	return {
		app,
		getActiveFile,
		getFileCache,
		workspaceOn,
		metadataOn,
		processFrontMatter,
		process,
		frontmatter: liveFrontmatter,
	};
}

// Defaults to a markdown file — the only kind the Deck/Model dropdowns work on.
function fakeTFile(overrides: Record<string, unknown> = {}): TFile {
	return Object.assign(
		Object.create(TFile.prototype) as TFile,
		{ extension: 'md' },
		overrides,
	);
}

function fakePlugin(
	overrides: Partial<AnkiBridgeSettings> = {},
	appOptions: Parameters<typeof fakeApp>[0] = {},
) {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const setActiveProfile = vi.fn().mockResolvedValue(undefined);
	const appParts = fakeApp(appOptions);
	const plugin = {
		app: appParts.app,
		settings: fakeSettings(overrides),
		saveSettings,
		setActiveProfile,
	} as unknown as AnkiBridgePlugin;
	return { plugin, saveSettings, setActiveProfile, ...appParts };
}

// A note that's open and has the given frontmatter (metadata cache pre-populated).
function noteOptions(frontmatter: Record<string, unknown>) {
	return { activeFile: fakeTFile(), frontmatter };
}

function handlerFor(
	mock: ReturnType<typeof vi.fn>,
	eventName: string,
): (...args: unknown[]) => void {
	const handler = mock.mock.calls.find(([name]) => name === eventName)?.[1] as
		| ((...args: unknown[]) => void)
		| undefined;
	if (!handler) throw new Error(`no "${eventName}" handler registered`);
	return handler;
}

// Setting row order: Profile (0), Deck (1), Model (2), Rebuild fields (3),
// then Fields (4+, only once the active note has both Deck and Model).
const PROFILE_IDX = 0;
const DECK_IDX = 1;
const MODEL_IDX = 2;
const REBUILD_IDX = 3;
const FIRST_FIELD_IDX = 4;

const deckDropdown = () => settings[DECK_IDX]?.dropdownComponents[0];
const modelDropdown = () => settings[MODEL_IDX]?.dropdownComponents[0];

function openView(plugin: AnkiBridgePlugin) {
	const view = new SidebarView({} as WorkspaceLeaf, plugin);
	return { view, opened: view.onOpen() };
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

	it('renders Profile, Deck, Model, Rebuild fields in that order — and no Save notes to', async () => {
		const { plugin } = fakePlugin();
		const { opened } = openView(plugin);

		await expect(opened).resolves.toBeUndefined();
		expect(contentElEmpty).toHaveBeenCalled();
		expect(contentElCreateEl).toHaveBeenCalledWith('h4', {
			text: 'Anki Bridge',
		});
		expect(settings[PROFILE_IDX]?.name).toBe('Profile');
		expect(settings[DECK_IDX]?.name).toBe('Deck');
		expect(settings[MODEL_IDX]?.name).toBe('Model');
		expect(settings[REBUILD_IDX]?.name).toBe('Note fields');
		expect(settings.some((s) => s.name === 'Save notes to')).toBe(false);
	});

	describe('Profile dropdown', () => {
		it('lists every profile and selects the active one', async () => {
			const { plugin } = fakePlugin({ activeProfileId: 'b' });

			await openView(plugin).opened;

			const dropdown = settings[PROFILE_IDX]?.dropdownComponents[0];
			expect(dropdown?.options).toEqual({ a: 'Japanese', b: 'Spanish' });
			expect(dropdown?.value).toBe('b');
		});

		it('picking a profile calls plugin.setActiveProfile', async () => {
			const { plugin, setActiveProfile } = fakePlugin();
			await openView(plugin).opened;

			await settings[PROFILE_IDX]?.dropdownComponents[0]?.triggerChange('b');

			expect(setActiveProfile).toHaveBeenCalledWith('b');
		});

		it('re-renders when the profile changes elsewhere (e.g. the Settings tab)', async () => {
			const { plugin, workspaceOn } = fakePlugin();
			await openView(plugin).opened;

			plugin.settings.profiles.push({ ...profileA, id: 'c', name: 'French' });
			plugin.settings.activeProfileId = 'c';
			handlerFor(workspaceOn, PROFILE_CHANGED_EVENT)();

			const dropdown = settings[PROFILE_IDX]?.dropdownComponents[0];
			expect(dropdown?.options).toMatchObject({ c: 'French' });
			expect(dropdown?.value).toBe('c');
		});
	});

	describe('Deck dropdown', () => {
		it('lists Anki’s decks and shows the active note’s anki_deck', async () => {
			deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
			const { plugin } = fakePlugin({}, noteOptions({ anki_deck: 'Spanish' }));

			await openView(plugin).opened;

			expect(deckDropdown()?.optionOrder).toEqual(['', 'Japanese', 'Spanish']);
			expect(deckDropdown()?.value).toBe('Spanish');
			expect(deckDropdown()?.disabled).toBe(false);
		});

		it('is disabled with a placeholder when no note is open', async () => {
			deckNamesMock.mockResolvedValue(['Japanese']);
			const { plugin } = fakePlugin();

			await openView(plugin).opened;

			expect(deckDropdown()?.disabled).toBe(true);
			expect(deckDropdown()?.options['']).toBe('No active note');
			expect(deckDropdown()?.value).toBe('');
		});

		it('is disabled when the active file is not a markdown note', async () => {
			const { plugin } = fakePlugin(
				{},
				{
					activeFile: fakeTFile({ extension: 'png' }),
					frontmatter: { anki_deck: 'Japanese' },
				},
			);

			await openView(plugin).opened;

			expect(deckDropdown()?.disabled).toBe(true);
			expect(deckDropdown()?.value).toBe('');
		});

		it('shows "Not set" when the note has no anki_deck', async () => {
			deckNamesMock.mockResolvedValue(['Japanese']);
			const { plugin } = fakePlugin({}, noteOptions({}));

			await openView(plugin).opened;

			expect(deckDropdown()?.options['']).toBe('Not set');
			expect(deckDropdown()?.value).toBe('');
			expect(deckDropdown()?.disabled).toBe(false);
		});

		it('still shows the note’s deck when Anki does not list it', async () => {
			deckNamesMock.mockResolvedValue(['Japanese']);
			const { plugin } = fakePlugin(
				{},
				noteOptions({ anki_deck: 'Deleted deck' }),
			);

			await openView(plugin).opened;

			expect(deckDropdown()?.options['Deleted deck']).toBe('Deleted deck');
			expect(deckDropdown()?.value).toBe('Deleted deck');
		});

		it('ignores the active profile — the note is the only source', async () => {
			deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
			const { plugin } = fakePlugin(
				{ profiles: [{ ...profileA, deck: 'Spanish' }] },
				noteOptions({ anki_deck: 'Japanese' }),
			);

			await openView(plugin).opened;

			expect(deckDropdown()?.value).toBe('Japanese');
		});

		it('writes the picked deck to the note’s frontmatter, not to settings', async () => {
			deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
			const { plugin, saveSettings, frontmatter, processFrontMatter } =
				fakePlugin({}, noteOptions({ anki_deck: 'Japanese' }));
			await openView(plugin).opened;

			await deckDropdown()?.triggerChange('Spanish');

			expect(frontmatter.anki_deck).toBe('Spanish');
			expect(processFrontMatter).toHaveBeenCalledTimes(1);
			expect(saveSettings).not.toHaveBeenCalled();
			expect(plugin.settings.profiles[0]?.deck).toBe('');
		});

		it('does not write anything when the "Not set" placeholder is picked', async () => {
			deckNamesMock.mockResolvedValue(['Japanese']);
			const { plugin, processFrontMatter } = fakePlugin(
				{},
				noteOptions({ anki_deck: 'Japanese' }),
			);
			await openView(plugin).opened;

			await deckDropdown()?.triggerChange('');

			expect(processFrontMatter).not.toHaveBeenCalled();
			expect(deckDropdown()?.value).toBe('Japanese');
		});

		it('has no Refresh button of its own', async () => {
			const { plugin } = fakePlugin();
			await openView(plugin).opened;

			expect(settings[DECK_IDX]?.buttonComponents).toHaveLength(0);
		});

		it('shows an error toast when loading decks fails, without throwing', async () => {
			deckNamesMock.mockRejectedValueOnce(new Error('boom'));
			const { plugin } = fakePlugin();

			await expect(openView(plugin).opened).resolves.toBeUndefined();

			expect(toastError).toHaveBeenCalledWith(
				'❌ Failed to load decks. Please check Anki connection.',
			);
		});
	});

	describe('Model dropdown', () => {
		it('lists Anki’s models and shows the active note’s anki_model', async () => {
			modelNamesMock.mockResolvedValue(['Basic', 'Cloze']);
			const { plugin } = fakePlugin({}, noteOptions({ anki_model: 'Cloze' }));

			await openView(plugin).opened;

			expect(modelDropdown()?.optionOrder).toEqual(['', 'Basic', 'Cloze']);
			expect(modelDropdown()?.value).toBe('Cloze');
		});

		it('is disabled when no note is open', async () => {
			const { plugin } = fakePlugin();

			await openView(plugin).opened;

			expect(modelDropdown()?.disabled).toBe(true);
		});

		it('writes the picked model to the note’s frontmatter, not to settings', async () => {
			modelNamesMock.mockResolvedValue(['Basic', 'Cloze']);
			const { plugin, saveSettings, frontmatter } = fakePlugin(
				{},
				noteOptions({ anki_model: 'Basic' }),
			);
			await openView(plugin).opened;

			await modelDropdown()?.triggerChange('Cloze');

			expect(frontmatter.anki_model).toBe('Cloze');
			expect(saveSettings).not.toHaveBeenCalled();
		});

		it('has no Refresh button of its own', async () => {
			const { plugin } = fakePlugin();
			await openView(plugin).opened;

			expect(settings[MODEL_IDX]?.buttonComponents).toHaveLength(0);
		});

		it('shows an error toast when loading models fails, without throwing', async () => {
			modelNamesMock.mockRejectedValueOnce(new Error('boom'));
			const { plugin } = fakePlugin();

			await expect(openView(plugin).opened).resolves.toBeUndefined();

			expect(toastError).toHaveBeenCalledWith(
				'❌ Failed to load models. Please check Anki connection.',
			);
		});
	});

	describe('field checkboxes follow the active note', () => {
		const pair = { anki_deck: 'Japanese', anki_model: 'Basic' };

		it('does not render field checkboxes when no note is open', async () => {
			const { plugin } = fakePlugin();

			await openView(plugin).opened;

			expect(modelFieldNamesMock).not.toHaveBeenCalled();
			expect(settings).toHaveLength(FIRST_FIELD_IDX);
			expect(fieldsContainerEl.empty).toHaveBeenCalled();
		});

		it('does not render field checkboxes until the note has both Deck and Model', async () => {
			const { plugin } = fakePlugin({}, noteOptions({ anki_deck: 'Japanese' }));

			await openView(plugin).opened;

			expect(modelFieldNamesMock).not.toHaveBeenCalled();
			expect(settings).toHaveLength(FIRST_FIELD_IDX);
		});

		it('ignores the active profile when the note has no Deck/Model', async () => {
			const { plugin } = fakePlugin(
				{ profiles: [{ ...profileA, deck: 'Japanese', model: 'Basic' }] },
				noteOptions({}),
			);

			await openView(plugin).opened;

			expect(modelFieldNamesMock).not.toHaveBeenCalled();
		});

		it('renders a toggle per model field of the note’s Model', async () => {
			modelFieldNamesMock.mockResolvedValue(['Meaning', 'Furigana']);
			const { plugin } = fakePlugin({}, noteOptions(pair));

			await openView(plugin).opened;

			expect(modelFieldNamesMock).toHaveBeenCalledWith('Basic');
			expect(fieldsContainerEl.createEl).toHaveBeenCalledWith('p', {
				text: 'Fields to generate with AI:',
			});
			expect(settings[FIRST_FIELD_IDX]?.name).toBe('Meaning');
			expect(settings[FIRST_FIELD_IDX + 1]?.name).toBe('Furigana');
		});

		it('pre-ticks fields previously selected for that Deck+Model pair', async () => {
			modelFieldNamesMock.mockResolvedValue(['Meaning', 'Furigana']);
			const key = fieldConfigKey('Japanese', 'Basic');
			const { plugin } = fakePlugin(
				{ generateWithAiFields: { [key]: ['Furigana'] } },
				noteOptions(pair),
			);

			await openView(plugin).opened;

			expect(settings[FIRST_FIELD_IDX]?.toggleComponents[0]?.value).toBe(false);
			expect(settings[FIRST_FIELD_IDX + 1]?.toggleComponents[0]?.value).toBe(
				true,
			);
		});

		it('does not leak ticked fields from a different Deck+Model pair', async () => {
			modelFieldNamesMock.mockResolvedValue(['Meaning']);
			const otherKey = fieldConfigKey('Spanish', 'Cloze');
			const { plugin } = fakePlugin(
				{ generateWithAiFields: { [otherKey]: ['Meaning'] } },
				noteOptions(pair),
			);

			await openView(plugin).opened;

			expect(settings[FIRST_FIELD_IDX]?.toggleComponents[0]?.value).toBe(false);
		});

		it('persists a ticked field for the note’s Deck+Model pair', async () => {
			modelFieldNamesMock.mockResolvedValue(['Meaning', 'Furigana']);
			const { plugin, saveSettings } = fakePlugin({}, noteOptions(pair));
			await openView(plugin).opened;
			saveSettings.mockClear();

			await settings[FIRST_FIELD_IDX]?.toggleComponents[0]?.triggerChange(true);

			const key = fieldConfigKey('Japanese', 'Basic');
			expect(plugin.settings.generateWithAiFields[key]).toEqual(['Meaning']);
			expect(saveSettings).toHaveBeenCalled();
		});

		it('removes a field from generateWithAiFields when unticked', async () => {
			modelFieldNamesMock.mockResolvedValue(['Meaning', 'Furigana']);
			const key = fieldConfigKey('Japanese', 'Basic');
			const { plugin } = fakePlugin(
				{ generateWithAiFields: { [key]: ['Meaning', 'Furigana'] } },
				noteOptions(pair),
			);
			await openView(plugin).opened;

			await settings[FIRST_FIELD_IDX]?.toggleComponents[0]?.triggerChange(false);

			expect(plugin.settings.generateWithAiFields[key]).toEqual(['Furigana']);
		});

		it('shows an error toast when loading fields fails, without throwing', async () => {
			modelFieldNamesMock.mockRejectedValueOnce(new Error('boom'));
			const { plugin } = fakePlugin({}, noteOptions(pair));

			await expect(openView(plugin).opened).resolves.toBeUndefined();

			expect(toastError).toHaveBeenCalledWith(
				'❌ Failed to load fields. Please check Anki connection.',
			);
		});

		it('re-syncs dropdowns and field list when switching to a different open note', async () => {
			modelFieldNamesMock.mockResolvedValueOnce(['Meaning']);
			deckNamesMock.mockResolvedValue(['Japanese', 'French']);
			const { plugin, getActiveFile, getFileCache, workspaceOn } = fakePlugin(
				{},
				noteOptions(pair),
			);
			await openView(plugin).opened;

			getActiveFile.mockReturnValue(fakeTFile());
			getFileCache.mockReturnValue({
				frontmatter: { anki_deck: 'French', anki_model: 'Cloze' },
			});
			modelFieldNamesMock.mockResolvedValueOnce(['Front', 'Back']);
			handlerFor(workspaceOn, 'file-open')();

			await vi.waitFor(() => {
				expect(modelFieldNamesMock).toHaveBeenLastCalledWith('Cloze');
			});
			expect(deckDropdown()?.value).toBe('French');
		});

		it('disables the dropdowns when the last note is closed', async () => {
			const { plugin, getActiveFile, workspaceOn } = fakePlugin(
				{},
				noteOptions(pair),
			);
			await openView(plugin).opened;
			expect(deckDropdown()?.disabled).toBe(false);

			getActiveFile.mockReturnValue(null);
			handlerFor(workspaceOn, 'file-open')();

			await vi.waitFor(() => {
				expect(deckDropdown()?.disabled).toBe(true);
			});
		});

		it('re-syncs when the active note’s metadata changes (e.g. Deck edited in YAML)', async () => {
			modelFieldNamesMock.mockResolvedValue(['Meaning']);
			const { plugin, getActiveFile, getFileCache, metadataOn } = fakePlugin(
				{},
				noteOptions(pair),
			);
			await openView(plugin).opened;
			const active = getActiveFile() as TFile;

			getFileCache.mockReturnValue({
				frontmatter: { anki_deck: 'Spanish', anki_model: 'Basic' },
			});
			handlerFor(metadataOn, 'changed')(active);

			await vi.waitFor(() => {
				expect(deckDropdown()?.value).toBe('Spanish');
			});
			expect(modelFieldNamesMock).toHaveBeenCalledTimes(2);
		});

		it('does not re-fetch fields when metadata changes but Deck+Model do not (typing in the note)', async () => {
			modelFieldNamesMock.mockResolvedValue(['Meaning']);
			const { plugin, getActiveFile, metadataOn } = fakePlugin(
				{},
				noteOptions(pair),
			);
			await openView(plugin).opened;

			handlerFor(metadataOn, 'changed')(getActiveFile());
			await Promise.resolve();

			expect(modelFieldNamesMock).toHaveBeenCalledTimes(1);
		});

		it('ignores metadata changes of notes that are not the active one', async () => {
			modelFieldNamesMock.mockResolvedValue(['Meaning']);
			const { plugin, getFileCache, metadataOn } = fakePlugin(
				{},
				noteOptions(pair),
			);
			await openView(plugin).opened;

			getFileCache.mockReturnValue({
				frontmatter: { anki_deck: 'Other', anki_model: 'Other' },
			});
			handlerFor(metadataOn, 'changed')(fakeTFile());
			await Promise.resolve();

			expect(modelFieldNamesMock).toHaveBeenCalledTimes(1);
			expect(deckDropdown()?.value).toBe('Japanese');
		});
	});

	describe('Rebuild fields', () => {
		const pair = { anki_deck: 'Japanese', anki_model: 'Basic' };
		const rebuildButton = () => settings[REBUILD_IDX]?.buttonComponents[0];

		it('renders below Model, and no connection status or refresh button anywhere', async () => {
			const { plugin } = fakePlugin({}, noteOptions(pair));

			await openView(plugin).opened;

			expect(settings[REBUILD_IDX]?.name).toBe('Note fields');
			expect(rebuildButton()?.text).toBe('Rebuild fields');
			expect(settings.some((s) => s.name.startsWith('Status:'))).toBe(false);
			expect(versionMock).not.toHaveBeenCalled();
		});

		it('is disabled with no active note, or when the note has no Model', async () => {
			const noNote = fakePlugin();
			await openView(noNote.plugin).opened;
			expect(rebuildButton()?.disabled).toBe(true);

			settings.length = 0;
			const noModel = fakePlugin({}, noteOptions({ anki_deck: 'Japanese' }));
			await openView(noModel.plugin).opened;
			expect(rebuildButton()?.disabled).toBe(true);
		});

		it('is enabled when the note has a Model', async () => {
			const { plugin } = fakePlugin({}, noteOptions(pair));

			await openView(plugin).opened;

			expect(rebuildButton()?.disabled).toBe(false);
		});

		it('asks for confirmation and does not touch the note until confirmed', async () => {
			const { plugin, process } = fakePlugin({}, noteOptions(pair));
			await openView(plugin).opened;

			await rebuildButton()?.triggerClick();

			expect(confirmRebuildOpen).toHaveBeenCalledTimes(1);
			expect(process).not.toHaveBeenCalled();
		});

		it('on confirm: replaces the note body with the Model’s fields, keeping frontmatter', async () => {
			modelFieldNamesMock.mockResolvedValue(['Front', 'Back']);
			const { plugin, process } = fakePlugin({}, noteOptions(pair));
			await openView(plugin).opened;
			modelFieldNamesMock.mockClear();
			await rebuildButton()?.triggerClick();

			confirmRebuildCapture.onConfirm?.();

			await vi.waitFor(() => {
				expect(process).toHaveBeenCalledTimes(1);
			});
			expect(modelFieldNamesMock).toHaveBeenCalledWith('Basic');
			expect(process.mock.results[0]?.value).toBe(
				'---\nanki_deck: Japanese\n---\n\n```anki-controls\n```\n\n## Front\n\n## Back\n',
			);
			expect(toastSuccess).toHaveBeenCalledWith('✅ Note fields rebuilt.');
			expect(rebuildButton()?.text).toBe('Rebuild fields');
		});

		it('on failure: leaves the note alone and shows an error toast', async () => {
			const { plugin, process } = fakePlugin({}, noteOptions(pair));
			await openView(plugin).opened;
			modelFieldNamesMock.mockRejectedValueOnce(new Error('boom'));
			await rebuildButton()?.triggerClick();

			confirmRebuildCapture.onConfirm?.();

			await vi.waitFor(() => {
				expect(toastError).toHaveBeenCalledWith(
					'❌ Failed to rebuild fields. Please check Anki connection.',
				);
			});
			expect(process).not.toHaveBeenCalled();
			expect(rebuildButton()?.disabled).toBe(false);
		});
	});
});

describe('Deck/Model change warning', () => {
	const synced = (extra: Record<string, unknown> = {}) =>
		noteOptions({
			anki_deck: 'Japanese',
			anki_model: 'Basic',
			anki_note_id: 123,
			...extra,
		});

	type Case = {
		label: 'Deck' | 'Model';
		key: 'anki_deck' | 'anki_model';
		idx: number;
		names: string[];
		from: string;
		to: string;
	};
	const cases: Case[] = [
		{
			label: 'Deck',
			key: 'anki_deck',
			idx: DECK_IDX,
			names: ['Japanese', 'Spanish'],
			from: 'Japanese',
			to: 'Spanish',
		},
		{
			label: 'Model',
			key: 'anki_model',
			idx: MODEL_IDX,
			names: ['Basic', 'Cloze'],
			from: 'Basic',
			to: 'Cloze',
		},
	];

	async function openSynced(c: Case) {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		modelNamesMock.mockResolvedValue(['Basic', 'Cloze']);
		const parts = fakePlugin({}, synced());
		await openView(parts.plugin).opened;
		const dropdown = settings[c.idx]?.dropdownComponents[0];
		return { ...parts, dropdown };
	}

	describe.each(cases)('$label dropdown on a synced note', (c) => {
		it('opens the warning modal instead of writing', async () => {
			const { dropdown, processFrontMatter, saveSettings } =
				await openSynced(c);

			await dropdown?.triggerChange(c.to);

			expect(deckModelWarningOpen).toHaveBeenCalledTimes(1);
			expect(processFrontMatter).not.toHaveBeenCalled();
			expect(saveSettings).not.toHaveBeenCalled();
		});

		it(`on Update: overwrites ${c.key} and clears anki_note_id`, async () => {
			const { dropdown, frontmatter } = await openSynced(c);
			await dropdown?.triggerChange(c.to);

			deckModelWarningCapture.onUpdate?.();

			await vi.waitFor(() => {
				expect(frontmatter[c.key]).toBe(c.to);
			});
			expect(frontmatter.anki_note_id).toBeUndefined();
		});

		it('on Keep old: reverts the dropdown and leaves the note untouched', async () => {
			const { dropdown, processFrontMatter, saveSettings } =
				await openSynced(c);
			await dropdown?.triggerChange(c.to);

			deckModelWarningCapture.onKeepOld?.();

			expect(dropdown?.value).toBe(c.from);
			expect(processFrontMatter).not.toHaveBeenCalled();
			expect(saveSettings).not.toHaveBeenCalled();
		});
	});

	it('writes directly, without a modal, when the note has no anki_note_id', async () => {
		deckNamesMock.mockResolvedValue(['Japanese', 'Spanish']);
		const { plugin, frontmatter } = fakePlugin(
			{},
			noteOptions({ anki_deck: 'Japanese' }),
		);
		await openView(plugin).opened;

		await deckDropdown()?.triggerChange('Spanish');

		expect(deckModelWarningOpen).not.toHaveBeenCalled();
		expect(frontmatter.anki_deck).toBe('Spanish');
	});

	it('writes the Model directly, without a modal, when the note has no anki_note_id', async () => {
		modelNamesMock.mockResolvedValue(['Basic', 'Cloze']);
		const { plugin, frontmatter } = fakePlugin(
			{},
			noteOptions({ anki_model: 'Basic' }),
		);
		await openView(plugin).opened;

		await modelDropdown()?.triggerChange('Cloze');

		expect(deckModelWarningOpen).not.toHaveBeenCalled();
		expect(frontmatter.anki_model).toBe('Cloze');
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
