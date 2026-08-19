import { beforeEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_ANKI_CONNECT_URL } from '../utils/constants';

class FakeTextComponent {
	placeholder = '';
	value = '';
	private changeCb: ((v: string) => unknown) | null = null;

	setPlaceholder(p: string) {
		this.placeholder = p;
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

class FakeDropdownComponent {
	options: Record<string, string> = {};
	selectEl: { empty: () => void };

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
}

class FakeSetting {
	name = '';
	desc = '';
	textComponents: FakeTextComponent[] = [];
	buttonComponents: FakeButtonComponent[] = [];
	dropdownComponents: FakeDropdownComponent[] = [];

	constructor(public containerEl: unknown) {}
	setName(n: string) {
		this.name = n;
		return this;
	}
	setDesc(d: string) {
		this.desc = d;
		return this;
	}
	addText(cb: (t: FakeTextComponent) => unknown) {
		const text = new FakeTextComponent();
		cb(text);
		this.textComponents.push(text);
		return this;
	}
	addButton(cb: (b: FakeButtonComponent) => unknown) {
		const button = new FakeButtonComponent();
		cb(button);
		this.buttonComponents.push(button);
		return this;
	}
	addDropdown(cb: (d: FakeDropdownComponent) => unknown) {
		const dropdown = new FakeDropdownComponent();
		cb(dropdown);
		this.dropdownComponents.push(dropdown);
		return this;
	}
}

interface FakeEl {
	classes: Set<string>;
	createDiv(opts?: { cls?: string }): FakeEl;
	toggleClass(cls: string, value: boolean): void;
	hasClass(cls: string): boolean;
}

function fakeDiv(cls?: string): FakeEl {
	const classes = new Set((cls ?? '').split(' ').filter(Boolean));
	return {
		classes,
		createDiv(opts) {
			return fakeDiv(opts?.cls);
		},
		toggleClass(c, value) {
			if (value) classes.add(c);
			else classes.delete(c);
		},
		hasClass(c) {
			return classes.has(c);
		},
	};
}

const { Notice, settings } = vi.hoisted(() => ({
	Notice: vi.fn(),
	settings: [] as FakeSetting[],
}));
vi.mock('obsidian', () => ({
	Notice,
	Setting: class {
		constructor(containerEl: unknown) {
			const s = new FakeSetting(containerEl);
			settings.push(s);
			return s;
		}
	},
	PluginSettingTab: class {},
}));

const { deckNames, modelNames } = vi.hoisted(() => ({
	deckNames: vi.fn(),
	modelNames: vi.fn(),
}));
vi.mock('../sync/ankiConnect', () => ({
	AnkiConnectClient: class {
		deckNames = deckNames;
		modelNames = modelNames;
	},
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));
vi.mock('./toast', () => ({ toastSuccess, toastError }));

import { renderConnectionSection } from './settingsTab';

// Returns the spy as a plain local (not read back off `plugin`) so assertions like
// `expect(saveSettings).toHaveBeenCalled()` don't trip @typescript-eslint/unbound-method.
function fakePlugin(ankiConnectUrl: string): {
	plugin: AnkiBridgePlugin;
	saveSettings: ReturnType<typeof vi.fn>;
} {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: { ankiConnectUrl },
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	return { plugin, saveSettings };
}

beforeEach(() => {
	Notice.mockClear();
	settings.length = 0;
	deckNames.mockReset();
	modelNames.mockReset();
	toastSuccess.mockClear();
	toastError.mockClear();
});

describe('renderConnectionSection — URL field', () => {
	it('renders the URL field with the placeholder and the current saved value', () => {
		const { plugin } = fakePlugin('http://localhost:9999');

		renderConnectionSection(fakeDiv() as unknown as HTMLElement, plugin);

		const text = settings[0]?.textComponents[0];
		expect(text?.placeholder).toBe(DEFAULT_ANKI_CONNECT_URL);
		expect(text?.value).toBe('http://localhost:9999');
	});

	it('saves a valid URL and calls plugin.saveSettings', async () => {
		const { plugin, saveSettings } = fakePlugin('');

		renderConnectionSection(fakeDiv() as unknown as HTMLElement, plugin);
		const text = settings[0]?.textComponents[0];
		await text?.triggerChange('http://localhost:1234');

		expect(plugin.settings.ankiConnectUrl).toBe('http://localhost:1234');
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});

	it('saves a blank value as-is (resolves to the default elsewhere)', async () => {
		const { plugin, saveSettings } = fakePlugin('http://localhost:1234');

		renderConnectionSection(fakeDiv() as unknown as HTMLElement, plugin);
		const text = settings[0]?.textComponents[0];
		await text?.triggerChange('   ');

		expect(plugin.settings.ankiConnectUrl).toBe('');
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});

	it('shows a Notice and does not save an invalid, non-blank URL', async () => {
		const { plugin, saveSettings } = fakePlugin('http://localhost:1234');

		renderConnectionSection(fakeDiv() as unknown as HTMLElement, plugin);
		const text = settings[0]?.textComponents[0];
		await text?.triggerChange('not a url');

		expect(Notice).toHaveBeenCalledWith(
			'❌ Invalid URL. Please check the AnkiConnect URL.',
		);
		expect(plugin.settings.ankiConnectUrl).toBe('http://localhost:1234');
		expect(saveSettings).not.toHaveBeenCalled();
	});
});

const HIDDEN_CLASS = 'anki-bridge-settings__hidden';

describe('renderConnectionSection — Connect button', () => {
	function renderAndConnect() {
		const { plugin } = fakePlugin('http://localhost:8765');
		renderConnectionSection(fakeDiv() as unknown as HTMLElement, plugin);

		const button = settings[0]?.buttonComponents[0];
		const deckDropdown = settings[1]?.dropdownComponents[0];
		const modelDropdown = settings[2]?.dropdownComponents[0];
		const dropdownsEl = settings[1]?.containerEl as FakeEl | undefined;
		if (!button || !deckDropdown || !modelDropdown || !dropdownsEl) {
			throw new Error(
				'expected button, both dropdowns, and their container to be rendered',
			);
		}
		return { button, deckDropdown, modelDropdown, dropdownsEl };
	}

	it('starts with the dropdowns hidden', () => {
		const { dropdownsEl } = renderAndConnect();

		expect(dropdownsEl.hasClass(HIDDEN_CLASS)).toBe(true);
		expect(settings[1]?.name).toBe('Default deck');
		expect(settings[2]?.name).toBe('Default model');
	});

	it('on success: populates both dropdowns, reveals them, shows the success toast', async () => {
		deckNames.mockResolvedValue(['Default', 'Japanese']);
		modelNames.mockResolvedValue(['Basic', 'Cloze']);
		const { button, deckDropdown, modelDropdown, dropdownsEl } =
			renderAndConnect();

		await button.triggerClick();

		expect(deckDropdown.options).toEqual({
			Default: 'Default',
			Japanese: 'Japanese',
		});
		expect(modelDropdown.options).toEqual({
			Basic: 'Basic',
			Cloze: 'Cloze',
		});
		expect(dropdownsEl.hasClass(HIDDEN_CLASS)).toBe(false);
		expect(toastSuccess).toHaveBeenCalledWith('✅ Connected to Anki!');
		expect(button.text).toBe('🔗 Connect');
		expect(button.disabled).toBe(false);
	});

	it('on failure: hides the dropdowns and shows the failure toast', async () => {
		deckNames.mockRejectedValue(new Error('offline'));
		modelNames.mockResolvedValue(['Basic']);
		const { button, dropdownsEl } = renderAndConnect();

		await button.triggerClick();

		expect(dropdownsEl.hasClass(HIDDEN_CLASS)).toBe(true);
		expect(toastError).toHaveBeenCalledWith(
			'❌ Cannot connect to Anki. Please check URL and AnkiConnect.',
		);
		expect(button.text).toBe('🔗 Connect');
		expect(button.disabled).toBe(false);
	});

	it('re-hides the dropdowns if a later Connect click fails after an earlier success', async () => {
		deckNames
			.mockResolvedValueOnce(['Default'])
			.mockRejectedValueOnce(new Error('offline'));
		modelNames.mockResolvedValue(['Basic']);
		const { button, deckDropdown, dropdownsEl } = renderAndConnect();

		await button.triggerClick();
		expect(deckDropdown.options).toEqual({ Default: 'Default' });
		expect(dropdownsEl.hasClass(HIDDEN_CLASS)).toBe(false);

		await button.triggerClick();

		expect(dropdownsEl.hasClass(HIDDEN_CLASS)).toBe(true);
		expect(toastError).toHaveBeenCalledTimes(1);
	});
});
