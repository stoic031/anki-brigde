import { afterEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_SETTINGS, type AnkiBridgeSettings } from '../settings';
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

class FakeSetting {
	name = '';
	desc = '';
	dropdown?: FakeDropdown;
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
}

const { settings } = vi.hoisted(() => ({ settings: [] as FakeSetting[] }));
vi.mock('obsidian', () => ({
	Setting: class {
		constructor() {
			const s = new FakeSetting();
			settings.push(s);
			return s;
		}
	},
}));

import { renderLanguageSection } from './languageSection';

afterEach(() => {
	vi.clearAllMocks();
	settings.length = 0;
});

function setup(overrides: Partial<AnkiBridgeSettings> = {}) {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: { ...structuredClone(DEFAULT_SETTINGS), ...overrides },
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	renderLanguageSection({} as HTMLElement, plugin);
	return { plugin, saveSettings, row: settings[0] };
}

describe('renderLanguageSection', () => {
	it('is a "Your language" select listing exactly the fixed language list, plus the placeholder', () => {
		const { row } = setup();

		expect(row?.name).toBe('Your language');
		expect(row?.dropdown?.optionOrder).toEqual(['', ...LANGUAGES]);
	});

	it('keeps its description', () => {
		const { row } = setup();

		expect(row?.desc).toContain('AI generation context');
	});

	it('shows the saved value', () => {
		const { row } = setup({ nativeLanguage: 'Japanese' });

		expect(row?.dropdown?.value).toBe('Japanese');
	});

	it('selecting a language persists it immediately', async () => {
		const { plugin, saveSettings, row } = setup();

		await row?.dropdown?.select('German');

		expect(plugin.settings.nativeLanguage).toBe('German');
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});
});
