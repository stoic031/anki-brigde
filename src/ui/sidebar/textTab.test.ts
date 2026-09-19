import { afterEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../../main';
import { fieldConfigKey, type AnkiBridgeSettings } from '../../settings';
import { FakeEl } from '../../test/fakeDom';

class FakeToggle {
	value = false;
	private cb: ((v: boolean) => unknown) | null = null;
	setValue(v: boolean) {
		this.value = v;
		return this;
	}
	onChange(cb: (v: boolean) => unknown) {
		this.cb = cb;
		return this;
	}
	async trigger(v: boolean) {
		this.value = v;
		await this.cb?.(v);
	}
}

class FakeSetting {
	name = '';
	toggle = new FakeToggle();
	setName(n: string) {
		this.name = n;
		return this;
	}
	addToggle(cb: (t: FakeToggle) => unknown) {
		cb(this.toggle);
		return this;
	}
}

const { Notice, setIcon, settings } = vi.hoisted(() => ({
	Notice: vi.fn(),
	setIcon: vi.fn(),
	settings: [] as unknown[],
}));
vi.mock('obsidian', () => ({
	Notice,
	setIcon,
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

import { renderTextTab } from './textTab';

afterEach(() => {
	vi.clearAllMocks();
	settings.length = 0;
});

function setup(overrides: Partial<AnkiBridgeSettings> = {}) {
	const parent = new FakeEl();
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: { ankiConnectUrl: '', generateWithAiFields: {}, ...overrides },
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	const tab = renderTextTab(parent as unknown as HTMLElement, plugin);
	const generate = parent.byClass('anki-bridge-sidebar__action')[0] as FakeEl;
	const fieldsEl = parent.byClass('anki-bridge-sidebar__field-checkboxes')[0] as FakeEl;
	const toggles = () => (settings as FakeSetting[]).map((s) => s.toggle);
	const names = () => (settings as FakeSetting[]).map((s) => s.name);
	return { parent, tab, plugin, saveSettings, generate, fieldsEl, toggles, names };
}

describe('renderTextTab', () => {
	it('renders the title with the Generate button (icon + text) next to it', () => {
		const { parent, generate } = setup();

		const header = parent.byClass('anki-bridge-sidebar__section-header')[0];
		expect(header?.children.map((c) => c.text || c.tag)).toEqual([
			'Fields to generate with AI',
			'button',
		]);
		expect(generate.children[1]?.text).toBe('Generate');
		expect(setIcon.mock.calls[0]?.[1]).toBe('sparkles');
		expect(generate.disabled).toBe(true);
	});

	it('shows a hint and keeps Generate disabled until the note has Deck and Model', async () => {
		const { tab, generate, fieldsEl } = setup();

		await tab.sync('Japanese', '');

		expect(modelFieldNames).not.toHaveBeenCalled();
		expect(fieldsEl.children[0]?.text).toBe(
			'Set a Deck and Model on the Note tab first.',
		);
		expect(generate.disabled).toBe(true);
	});

	it('renders a toggle per field of the Model and enables Generate', async () => {
		modelFieldNames.mockResolvedValue(['Meaning', 'Furigana']);
		const { tab, generate, names } = setup();

		await tab.sync('Japanese', 'Basic');

		expect(modelFieldNames).toHaveBeenCalledWith('Basic');
		expect(names()).toEqual(['Meaning', 'Furigana']);
		expect(generate.disabled).toBe(false);
	});

	it('pre-ticks fields saved for that Deck+Model pair only', async () => {
		modelFieldNames.mockResolvedValue(['Meaning', 'Furigana']);
		const { tab, toggles } = setup({
			generateWithAiFields: {
				[fieldConfigKey('Japanese', 'Basic')]: ['Furigana'],
				[fieldConfigKey('Spanish', 'Cloze')]: ['Meaning'],
			},
		});

		await tab.sync('Japanese', 'Basic');

		expect(toggles().map((t) => t.value)).toEqual([false, true]);
	});

	it('persists a ticked and an unticked field for the current pair', async () => {
		modelFieldNames.mockResolvedValue(['Meaning', 'Furigana']);
		const { tab, plugin, saveSettings, toggles } = setup();
		await tab.sync('Japanese', 'Basic');
		const key = fieldConfigKey('Japanese', 'Basic');

		await toggles()[0]?.trigger(true);
		await toggles()[1]?.trigger(true);
		expect(plugin.settings.generateWithAiFields[key]).toEqual(['Meaning', 'Furigana']);

		await toggles()[0]?.trigger(false);
		expect(plugin.settings.generateWithAiFields[key]).toEqual(['Furigana']);
		expect(saveSettings).toHaveBeenCalledTimes(3);
	});

	it('does not re-fetch fields when the pair has not changed', async () => {
		modelFieldNames.mockResolvedValue(['Meaning']);
		const { tab } = setup();

		await tab.sync('Japanese', 'Basic');
		await tab.sync('Japanese', 'Basic');

		expect(modelFieldNames).toHaveBeenCalledTimes(1);
	});

	it('re-fetches and replaces the list when the pair changes', async () => {
		modelFieldNames.mockResolvedValueOnce(['Meaning']);
		const { tab, fieldsEl } = setup();
		await tab.sync('Japanese', 'Basic');

		modelFieldNames.mockResolvedValueOnce(['Front', 'Back']);
		await tab.sync('Japanese', 'Cloze');

		expect(modelFieldNames).toHaveBeenLastCalledWith('Cloze');
		expect(fieldsEl.children).toHaveLength(0); // Setting rows live on the fake, not the el
		expect((settings as FakeSetting[]).slice(-2).map((s) => s.name)).toEqual([
			'Front',
			'Back',
		]);
	});

	it('drops a slow response for a pair that is no longer current', async () => {
		let resolveSlow!: (v: string[]) => void;
		modelFieldNames
			.mockReturnValueOnce(new Promise<string[]>((r) => (resolveSlow = r)))
			.mockResolvedValueOnce(['Front']);
		const { tab, names } = setup();

		const slow = tab.sync('Japanese', 'Basic');
		await tab.sync('Spanish', 'Cloze');
		resolveSlow(['Stale']);
		await slow;

		expect(names()).toEqual(['Front']);
	});

	it('shows an error toast when loading fields fails, without throwing', async () => {
		modelFieldNames.mockRejectedValue(new Error('boom'));
		const { tab } = setup();

		await expect(tab.sync('Japanese', 'Basic')).resolves.toBeUndefined();

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to load fields. Please check Anki connection.',
		);
	});

	describe('Generate button', () => {
		it('says to configure fields when none are ticked for the pair', async () => {
			modelFieldNames.mockResolvedValue(['Meaning']);
			const { tab, generate } = setup();
			await tab.sync('Japanese', 'Basic');

			await generate.click();

			expect(Notice).toHaveBeenCalledWith(
				'Please configure AI field generation for this Deck/Model in the sidebar (Text tab) first.',
			);
		});

		it('says generation is not available yet once fields are ticked', async () => {
			modelFieldNames.mockResolvedValue(['Meaning']);
			const { tab, generate } = setup({
				generateWithAiFields: {
					[fieldConfigKey('Japanese', 'Basic')]: ['Meaning'],
				},
			});
			await tab.sync('Japanese', 'Basic');

			await generate.click();

			expect(Notice).toHaveBeenCalledWith('Generate with AI is not available yet.');
		});

		it('does nothing while disabled', async () => {
			const { generate } = setup();

			await generate.click();

			expect(Notice).not.toHaveBeenCalled();
		});
	});
});
