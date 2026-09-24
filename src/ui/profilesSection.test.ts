import { afterEach, describe, expect, it, vi } from 'vitest';
import type VocabWeavePlugin from '../main';
import { DEFAULT_SETTINGS, type VocabWeaveSettings } from '../settings';
import { FakeEl } from '../test/fakeDom';
import { LANGUAGES } from '../utils/constants';

class FakeDropdown {
	options: Record<string, string> = {};
	optionOrder: string[] = [];
	value = '';
	private cb: ((v: string) => unknown) | null = null;
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
		this.cb = cb;
		return this;
	}
	async select(v: string) {
		this.value = v;
		await this.cb?.(v);
	}
}

class FakeText {
	value = '';
	placeholder = '';
	inputEl = {
		addEventListener: (_e: string, cb: () => unknown) => {
			this.changeCb = cb;
		},
	};
	private changeCb: (() => unknown) | null = null;
	private onChangeCb: ((v: string) => unknown) | null = null;
	setValue(v: string) {
		this.value = v;
		return this;
	}
	getValue() {
		return this.value;
	}
	setPlaceholder(p: string) {
		this.placeholder = p;
		return this;
	}
	onChange(cb: (v: string) => unknown) {
		this.onChangeCb = cb;
		return this;
	}
	// Simulates the input firing 'change' (blur/enter) with a new value.
	async change(v: string) {
		this.value = v;
		await this.changeCb?.();
	}
	async type(v: string) {
		this.value = v;
		await this.onChangeCb?.(v);
	}
}

class FakeButton {
	text = '';
	warning = false;
	disabled = false;
	private cb: (() => unknown) | null = null;
	setButtonText(t: string) {
		this.text = t;
		return this;
	}
	setDestructive() {
		this.warning = true;
		return this;
	}
	setDisabled(d: boolean) {
		this.disabled = d;
		return this;
	}
	onClick(cb: () => unknown) {
		this.cb = cb;
		return this;
	}
	async click() {
		await this.cb?.();
	}
}

class FakeSetting {
	name = '';
	desc = '';
	dropdown?: FakeDropdown;
	text?: FakeText;
	buttons: FakeButton[] = [];
	setName(n: string) {
		this.name = n;
		return this;
	}
	setDesc(d: string) {
		this.desc = d;
		return this;
	}
	addDropdown(cb: (d: FakeDropdown) => unknown) {
		this.dropdown = new FakeDropdown();
		cb(this.dropdown);
		return this;
	}
	addText(cb: (t: FakeText) => unknown) {
		this.text = new FakeText();
		cb(this.text);
		return this;
	}
	addButton(cb: (b: FakeButton) => unknown) {
		const b = new FakeButton();
		cb(b);
		this.buttons.push(b);
		return this;
	}
}

const { Notice, settings } = vi.hoisted(() => ({
	Notice: vi.fn(),
	settings: [] as FakeSetting[],
}));
vi.mock('obsidian', () => ({
	Notice,
	Setting: class {
		constructor() {
			const s = new FakeSetting();
			settings.push(s);
			return s;
		}
	},
}));

const { modelFieldNames, AnkiConnectClient } = vi.hoisted(() => {
	const modelFieldNames = vi.fn();
	class AnkiConnectClient {
		modelFieldNames = modelFieldNames;
	}
	return { modelFieldNames, AnkiConnectClient };
});
vi.mock('../sync/ankiConnect', () => ({ AnkiConnectClient }));

import { renderProfilesSection } from './profilesSection';

afterEach(() => {
	vi.clearAllMocks();
	settings.length = 0;
});

function latestRow(name: string): FakeSetting | undefined {
	return [...settings].reverse().find((s) => s.name === name);
}

function setup(overrides: Partial<VocabWeaveSettings> = {}) {
	const parent = new FakeEl();
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const settingsObj = {
		...structuredClone(DEFAULT_SETTINGS),
		...overrides,
	};
	const on = vi.fn();
	// Mirrors the real plugin.setActiveProfile (src/main.ts): set id, save, fire the
	// PROFILE_CHANGED_EVENT this section listens for — so it re-renders, same as the
	// real app. Model's onChange (and Add/Delete/Profile-switch) rely on this.
	const setActiveProfile = vi.fn(async (id: string) => {
		settingsObj.activeProfileId = id;
		await saveSettings();
		(on.mock.calls[0]?.[1] as (() => void) | undefined)?.();
	});
	const plugin = {
		settings: settingsObj,
		saveSettings,
		setActiveProfile,
		app: {
			workspace: { on, offref: vi.fn() },
			vault: { getAllFolders: vi.fn().mockReturnValue([]) },
		},
	} as unknown as VocabWeavePlugin;
	const section = renderProfilesSection(
		parent as unknown as HTMLElement,
		plugin,
	);
	// The PROFILE_CHANGED_EVENT handler registered via workspace.on — re-runs render()
	// exactly as e.g. Add/Delete or an active-profile switch would.
	const rerender = on.mock.calls[0]?.[1] as () => void;
	return { parent, plugin, saveSettings, section, rerender };
}

describe('renderProfilesSection — Main field', () => {
	it('is disabled/empty (only the placeholder) when the profile has no Model', () => {
		setup();

		expect(latestRow('Main field')?.dropdown?.optionOrder).toEqual(['']);
		expect(modelFieldNames).not.toHaveBeenCalled();
	});

	it('fetches and lists the Model’s fields once the profile has a Model', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		setup({
			profiles: [
				{
					id: 'default',
					name: 'Default',
					deck: 'Japanese',
					model: 'Basic',
					folder: '',
					mainField: '',
					targetLanguage: '',
				},
			],
		});
		await vi.waitFor(() =>
			expect(modelFieldNames).toHaveBeenCalledWith('Basic'),
		);

		expect(latestRow('Main field')?.dropdown?.optionOrder).toEqual([
			'',
			'Word',
			'Meaning',
			'Furigana',
		]);
	});

	it('restores the saved Main field for the profile', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		setup({
			profiles: [
				{
					id: 'default',
					name: 'Default',
					deck: 'Japanese',
					model: 'Basic',
					folder: '',
					mainField: 'Meaning',
					targetLanguage: '',
				},
			],
		});
		await vi.waitFor(() => expect(modelFieldNames).toHaveBeenCalled());

		expect(latestRow('Main field')?.dropdown?.value).toBe('Meaning');
	});

	it('selecting a field persists it', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		const { plugin, saveSettings } = setup({
			profiles: [
				{
					id: 'default',
					name: 'Default',
					deck: 'Japanese',
					model: 'Basic',
					folder: '',
					mainField: '',
					targetLanguage: '',
				},
			],
		});
		await vi.waitFor(() => expect(modelFieldNames).toHaveBeenCalled());

		await latestRow('Main field')?.dropdown?.select('Word');

		expect(plugin.settings.profiles[0]?.mainField).toBe('Word');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('clears the selected Main field and refetches when Model changes', async () => {
		modelFieldNames
			.mockResolvedValueOnce(['Word', 'Meaning'])
			.mockResolvedValueOnce(['Front', 'Back']);
		const { plugin } = setup({
			profiles: [
				{
					id: 'default',
					name: 'Default',
					deck: 'Japanese',
					model: 'Basic',
					folder: '',
					mainField: 'Meaning',
					targetLanguage: '',
				},
			],
		});
		await vi.waitFor(() =>
			expect(modelFieldNames).toHaveBeenCalledWith('Basic'),
		);
		expect(latestRow('Main field')?.dropdown?.value).toBe('Meaning');

		await latestRow('Model')?.dropdown?.select('Cloze');

		expect(plugin.settings.profiles[0]?.mainField).toBe('');
		await vi.waitFor(() =>
			expect(modelFieldNames).toHaveBeenCalledWith('Cloze'),
		);
		expect(latestRow('Main field')?.dropdown?.value).toBe('');
		expect(latestRow('Main field')?.dropdown?.optionOrder).toEqual([
			'',
			'Front',
			'Back',
		]);
	});

	it('does not re-fetch when re-rendered with the same Model', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		const { rerender } = setup({
			profiles: [
				{
					id: 'default',
					name: 'Default',
					deck: 'Japanese',
					model: 'Basic',
					folder: '',
					mainField: '',
					targetLanguage: '',
				},
			],
		});
		await vi.waitFor(() =>
			expect(modelFieldNames).toHaveBeenCalledTimes(1),
		);

		rerender(); // e.g. what Add/Delete or a profile switch triggers

		expect(modelFieldNames).toHaveBeenCalledTimes(1);
	});
});

describe('renderProfilesSection — Learning language', () => {
	it('is a select listing exactly the fixed language list, plus the placeholder', () => {
		setup();

		expect(latestRow('Learning language')?.dropdown?.optionOrder).toEqual([
			'',
			...LANGUAGES,
		]);
	});

	it('selecting a language persists it immediately', async () => {
		const { plugin, saveSettings } = setup();

		await latestRow('Learning language')?.dropdown?.select('Japanese');

		expect(plugin.settings.profiles[0]?.targetLanguage).toBe('Japanese');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('shows the saved value', () => {
		setup({
			profiles: [
				{
					id: 'default',
					name: 'Default',
					deck: '',
					model: '',
					folder: '',
					mainField: '',
					targetLanguage: 'Spanish',
				},
			],
		});

		expect(latestRow('Learning language')?.dropdown?.value).toBe('Spanish');
	});

	it('still shows a value saved before the fixed list existed (free text)', () => {
		setup({
			profiles: [
				{
					id: 'default',
					name: 'Default',
					deck: '',
					model: '',
					folder: '',
					mainField: '',
					targetLanguage: 'Klingon',
				},
			],
		});

		expect(latestRow('Learning language')?.dropdown?.value).toBe('Klingon');
		expect(latestRow('Learning language')?.dropdown?.optionOrder).toContain(
			'Klingon',
		);
	});
});
