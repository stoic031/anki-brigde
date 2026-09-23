import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
	Notice: vi.fn(function () {
		return { hide: vi.fn() };
	}),
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

const { toastError, toastSuccess } = vi.hoisted(() => ({
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
}));
vi.mock('../toast', () => ({ toastError, toastSuccess }));

const { planGenerate, runGenerate } = vi.hoisted(() => ({
	planGenerate: vi.fn(),
	runGenerate: vi.fn(),
}));
vi.mock('../../note/generateFields', () => ({ planGenerate, runGenerate }));

const note = { path: 'a.md' };
const flush = () => new Promise((r) => setTimeout(r, 0));

import { renderTextTab } from './textTab';

beforeEach(() => {
	// runAction schedules its restore with window.setTimeout; Node has no `window`.
	vi.stubGlobal('window', globalThis);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	settings.length = 0;
});

function setup(overrides: Partial<AnkiBridgeSettings> = {}) {
	const parent = new FakeEl();
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: {
			ankiConnectUrl: '',
			generateWithAiFields: {},
			...overrides,
		},
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	const tab = renderTextTab(
		parent as unknown as HTMLElement,
		plugin,
		() => note as never,
	);
	const generate = parent.byClass('anki-bridge-sidebar__action')[0] as FakeEl;
	const fieldsEl = parent.byClass(
		'anki-bridge-sidebar__field-checkboxes',
	)[0] as FakeEl;
	const toggles = () => (settings as FakeSetting[]).map((s) => s.toggle);
	const names = () => (settings as FakeSetting[]).map((s) => s.name);
	return {
		parent,
		tab,
		plugin,
		saveSettings,
		generate,
		fieldsEl,
		toggles,
		names,
	};
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
			'Set a Deck and Model above first.',
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
		expect(plugin.settings.generateWithAiFields[key]).toEqual([
			'Meaning',
			'Furigana',
		]);

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
		expect(
			(settings as FakeSetting[]).slice(-2).map((s) => s.name),
		).toEqual(['Front', 'Back']);
	});

	it('drops a slow response for a pair that is no longer current', async () => {
		let resolveSlow!: (v: string[]) => void;
		modelFieldNames
			.mockReturnValueOnce(
				new Promise<string[]>((r) => (resolveSlow = r)),
			)
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
		const plan = { provider: {}, word: 'w', targetFields: ['Meaning'] };

		async function ready() {
			modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
			const ctx = setup();
			await ctx.tab.sync('Japanese', 'Basic');
			return ctx;
		}

		it('shows the reason as a Notice when the plan says stop, and never calls the model', async () => {
			planGenerate.mockResolvedValue({
				stop: 'Set up a text model in settings first.',
			});
			const { generate } = await ready();

			await generate.click();
			await flush();

			expect(Notice).toHaveBeenCalledWith(
				'Set up a text model in settings first.',
			);
			expect(runGenerate).not.toHaveBeenCalled();
		});

		it('runs the model, cycles the button, and toasts the counts', async () => {
			planGenerate.mockResolvedValue(plan);
			runGenerate.mockResolvedValue({
				filled: ['Meaning'],
				skipped: ['Furigana'],
			});
			const { generate } = await ready();

			await generate.click();
			await flush();

			expect(runGenerate).toHaveBeenCalledWith(
				expect.anything(),
				note,
				plan,
			);
			expect(generate.children[1]?.text).toBe('✅ Done!');
			expect(toastSuccess).toHaveBeenCalledWith(
				'✅ AI content generated: 1 filled, 1 skipped (already had content).',
			);
		});

		it('is not re-enabled by sync() while a generation is running', async () => {
			planGenerate.mockResolvedValue(plan);
			let finish: (v: unknown) => void = () => {};
			runGenerate.mockReturnValue(new Promise((r) => (finish = r)));
			const { generate, tab } = await ready();

			await generate.click();
			await flush();
			expect(generate.children[1]?.text).toBe('⏳ Generating...');
			await tab.sync('Japanese', 'Basic');
			expect(generate.disabled).toBe(true);

			finish({ filled: [], skipped: [] });
			await flush();
		});

		it('surfaces a ProviderError message', async () => {
			const { ProviderError } = await import('../../types');
			planGenerate.mockResolvedValue(plan);
			runGenerate.mockRejectedValue(
				new ProviderError('anthropic', 'HTTP 401 from https://x'),
			);
			const { generate } = await ready();

			await generate.click();
			await flush();

			expect(toastError).toHaveBeenCalledWith(
				'❌ anthropic: HTTP 401 from https://x',
			);
			// A failure must not also show the "returned nothing" Notice reserved for a
			// real empty-result outcome — that would contradict the error toast above.
			expect(Notice).not.toHaveBeenCalledWith(
				'The text model returned nothing to add. Try again or check the model.',
			);
			expect(toastSuccess).not.toHaveBeenCalled();
		});

		it('tells the user when the model returned nothing', async () => {
			planGenerate.mockResolvedValue(plan);
			runGenerate.mockResolvedValue({ filled: [], skipped: [] });
			const { generate } = await ready();

			await generate.click();
			await flush();

			expect(toastSuccess).not.toHaveBeenCalled();
			expect(Notice).toHaveBeenCalledWith(
				'The text model returned nothing to add. Try again or check the model.',
			);
		});

		it('does nothing while disabled', async () => {
			const { generate } = setup();

			await generate.click();
			await flush();

			expect(planGenerate).not.toHaveBeenCalled();
		});
	});
});
