import { afterEach, describe, expect, it, vi } from 'vitest';
import type VocabWeavePlugin from '../../main';
import { fieldConfigKey, type VocabWeaveSettings } from '../../settings';

class FakeDropdown {
	options: Record<string, string> = {};
	optionOrder: string[] = [];
	value = '';
	disabled = false;
	selectEl = {
		empty: () => {
			this.options = {};
			this.optionOrder = [];
		},
	};
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
	setDisabled(d: boolean) {
		this.disabled = d;
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
	dropdown?: FakeDropdown;
	setName(n: string) {
		this.name = n;
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

const { modelFieldNames, AnkiConnectClient } = vi.hoisted(() => {
	const modelFieldNames = vi.fn();
	class AnkiConnectClient {
		modelFieldNames = modelFieldNames;
	}
	return { modelFieldNames, AnkiConnectClient };
});
vi.mock('../../sync/ankiConnect', () => ({ AnkiConnectClient }));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('../toast', () => ({ toastError }));

import { renderMainFieldDropdown } from './mainField';

afterEach(() => {
	vi.clearAllMocks();
	settings.length = 0;
});

function setup(overrides: Partial<VocabWeaveSettings> = {}) {
	const parent = {} as HTMLElement;
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: { ankiConnectUrl: '', mainFieldConfig: {}, ...overrides },
		saveSettings,
	} as unknown as VocabWeavePlugin;
	const onChange = vi.fn();
	const control = renderMainFieldDropdown(parent, plugin, onChange);
	const dropdown = settings[0]?.dropdown as FakeDropdown;
	return { control, plugin, saveSettings, onChange, dropdown };
}

describe('renderMainFieldDropdown', () => {
	it('renders a "Main Field" setting, disabled with no Deck/Model', async () => {
		const { control, dropdown } = setup();

		await control.sync('', '');

		expect(settings[0]?.name).toBe('Main field');
		expect(dropdown.disabled).toBe(true);
		expect(modelFieldNames).not.toHaveBeenCalled();
	});

	it('lists the model fields and restores the saved value for the pair', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		const key = fieldConfigKey('Japanese', 'Basic');
		const { control, dropdown } = setup({
			mainFieldConfig: { [key]: 'Meaning' },
		});

		await control.sync('Japanese', 'Basic');

		expect(modelFieldNames).toHaveBeenCalledWith('Basic');
		expect(dropdown.optionOrder).toEqual([
			'',
			'Word',
			'Meaning',
			'Furigana',
		]);
		expect(dropdown.value).toBe('Meaning');
		expect(dropdown.disabled).toBe(false);
	});

	it('falls back to unselected when the saved field is no longer on the model', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		const key = fieldConfigKey('Japanese', 'Basic');
		const { control, dropdown } = setup({
			mainFieldConfig: { [key]: 'Stale' },
		});

		await control.sync('Japanese', 'Basic');

		expect(dropdown.value).toBe('');
	});

	it('selecting a field persists it and calls onChange', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		const key = fieldConfigKey('Japanese', 'Basic');
		const { control, dropdown, plugin, saveSettings, onChange } = setup();

		await control.sync('Japanese', 'Basic');
		await dropdown.select('Word');

		expect(plugin.settings.mainFieldConfig[key]).toBe('Word');
		expect(saveSettings).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it('does not re-fetch fields when the pair has not changed', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		const { control } = setup();

		await control.sync('Japanese', 'Basic');
		await control.sync('Japanese', 'Basic');

		expect(modelFieldNames).toHaveBeenCalledTimes(1);
	});

	it('re-fetches when the pair changes', async () => {
		modelFieldNames
			.mockResolvedValueOnce(['Word', 'Meaning'])
			.mockResolvedValueOnce(['Front', 'Back']);
		const { control, dropdown } = setup();

		await control.sync('Japanese', 'Basic');
		await control.sync('Japanese', 'Cloze');

		expect(modelFieldNames).toHaveBeenLastCalledWith('Cloze');
		expect(dropdown.optionOrder).toEqual(['', 'Front', 'Back']);
	});

	it('drops a slow response for a pair that is no longer current', async () => {
		let resolveSlow!: (v: string[]) => void;
		modelFieldNames
			.mockReturnValueOnce(
				new Promise<string[]>((r) => (resolveSlow = r)),
			)
			.mockResolvedValueOnce(['Front', 'Back']);
		const { control, dropdown } = setup();

		const slow = control.sync('Japanese', 'Basic');
		await control.sync('Spanish', 'Cloze');
		resolveSlow(['Stale']);
		await slow;

		expect(dropdown.optionOrder).toEqual(['', 'Front', 'Back']);
	});

	it('shows an error toast when loading fields fails, without throwing', async () => {
		modelFieldNames.mockRejectedValue(new Error('boom'));
		const { control } = setup();

		await expect(
			control.sync('Japanese', 'Basic'),
		).resolves.toBeUndefined();

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to load fields. Please check Anki connection.',
		);
	});
});
