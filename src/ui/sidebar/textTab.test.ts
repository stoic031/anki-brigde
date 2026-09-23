import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../../main';
import { fieldConfigKey, type AnkiBridgeSettings } from '../../settings';
import { FakeEl } from '../../test/fakeDom';

class FakeDropdown {
	options: Record<string, string> = {};
	optionOrder: string[] = [];
	value = '';
	disabled = false;
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

class FakeExtraButton {
	icon = '';
	private cb: (() => unknown) | null = null;
	setIcon(i: string) {
		this.icon = i;
		return this;
	}
	setTooltip(_t: string) {
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

class FakeTextArea {
	value = '';
	private changeCb: (() => unknown) | null = null;
	inputEl = {
		addEventListener: (_event: string, cb: () => unknown) => {
			this.changeCb = cb;
		},
	};
	setValue(v: string) {
		this.value = v;
		return this;
	}
	getValue() {
		return this.value;
	}
	async edit(v: string) {
		this.value = v;
		await this.changeCb?.();
	}
}

class FakeSetting {
	name = '';
	dropdown?: FakeDropdown;
	extraButtons: FakeExtraButton[] = [];
	textArea?: FakeTextArea;
	setName(n: string) {
		this.name = n;
		return this;
	}
	addDropdown(cb: (d: FakeDropdown) => unknown) {
		this.dropdown = new FakeDropdown();
		cb(this.dropdown);
		return this;
	}
	addExtraButton(cb: (b: FakeExtraButton) => unknown) {
		const b = new FakeExtraButton();
		cb(b);
		this.extraButtons.push(b);
		return this;
	}
	addTextArea(cb: (a: FakeTextArea) => unknown) {
		this.textArea = new FakeTextArea();
		cb(this.textArea);
		return this;
	}
}

const { Notice, setIcon, settings } = vi.hoisted(() => ({
	Notice: vi.fn(function () {
		return { hide: vi.fn() };
	}),
	setIcon: vi.fn(),
	settings: [] as FakeSetting[],
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

const { planGenerate, generateDraft, applyGenerated } = vi.hoisted(() => ({
	planGenerate: vi.fn(),
	generateDraft: vi.fn(),
	applyGenerated: vi.fn(),
}));
vi.mock('../../note/generateFields', () => ({
	planGenerate,
	generateDraft,
	applyGenerated,
}));

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

// Settings are re-created on every render without clearing old ones (they live on a
// fake, not real DOM) — the freshest one for a given name/kind is always the current
// render's, same convention as settingsTab.test.ts's `latest()`.
function latestDropdown(): FakeDropdown | undefined {
	return [...settings].reverse().find((s) => s.dropdown)?.dropdown;
}
function latestRow(name: string): FakeSetting | undefined {
	return [...settings].reverse().find((s) => s.name === name);
}

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
	const actions = parent.byClass('anki-bridge-sidebar__action');
	const generate = actions[0] as FakeEl;
	const write = actions[1] as FakeEl;
	const fieldsEl = parent.byClass(
		'anki-bridge-sidebar__field-checkboxes',
	)[0] as FakeEl;
	return {
		parent,
		tab,
		plugin,
		saveSettings,
		generate,
		write,
		fieldsEl,
	};
}

describe('renderTextTab', () => {
	it('renders the title with Generate and Write buttons (icon + text), both disabled', () => {
		const { parent, generate, write } = setup();

		const header = parent.byClass('anki-bridge-sidebar__section-header')[0];
		expect(header?.children.map((c) => c.text || c.tag)).toEqual([
			'Fields to generate with AI',
			'button',
			'button',
		]);
		expect(generate.children[1]?.text).toBe('Generate');
		expect(write.children[1]?.text).toBe('Write');
		expect(setIcon.mock.calls[0]?.[1]).toBe('sparkles');
		expect(setIcon.mock.calls[1]?.[1]).toBe('save');
		expect(generate.disabled).toBe(true);
		expect(write.disabled).toBe(true);
	});

	it('shows a hint and keeps both buttons disabled until the note has Deck and Model', async () => {
		const { tab, generate, write, fieldsEl } = setup();

		await tab.sync('Japanese', '');

		expect(modelFieldNames).not.toHaveBeenCalled();
		expect(fieldsEl.children[0]?.text).toBe(
			'Set a Deck and Model above first.',
		);
		expect(generate.disabled).toBe(true);
		expect(write.disabled).toBe(true);
	});

	it('offers every field but the input field to add, and enables both buttons', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		const { tab, generate, write } = setup();

		await tab.sync('Japanese', 'Basic');

		expect(modelFieldNames).toHaveBeenCalledWith('Basic');
		expect(latestDropdown()?.optionOrder).toEqual(['', 'Meaning', 'Furigana']);
		expect(generate.disabled).toBe(false);
		expect(write.disabled).toBe(false);
	});

	it('restores fields already added for that Deck+Model pair only, excluding the input field', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		const { tab } = setup({
			generateWithAiFields: {
				[fieldConfigKey('Japanese', 'Basic')]: ['Word', 'Furigana'],
				[fieldConfigKey('Spanish', 'Cloze')]: ['Meaning'],
			},
		});

		await tab.sync('Japanese', 'Basic');

		expect(latestRow('Furigana')).toBeDefined();
		expect(latestRow('Word')).toBeUndefined(); // input field, never addable
		expect(latestRow('Meaning')).toBeUndefined(); // belongs to a different pair
		// Already-added fields are no longer offered in the dropdown.
		expect(latestDropdown()?.optionOrder).toEqual(['', 'Meaning']);
	});

	it('adding a field persists it and removes it from the dropdown', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		const { tab, plugin, saveSettings } = setup();
		await tab.sync('Japanese', 'Basic');

		await latestDropdown()?.select('Meaning');

		const key = fieldConfigKey('Japanese', 'Basic');
		expect(plugin.settings.generateWithAiFields[key]).toEqual(['Meaning']);
		expect(saveSettings).toHaveBeenCalledTimes(1);
		expect(latestRow('Meaning')).toBeDefined();
		expect(latestDropdown()?.optionOrder).toEqual(['', 'Furigana']);
	});

	it('removing a field persists it and drops its draft', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		const { tab, plugin } = setup({
			generateWithAiFields: {
				[fieldConfigKey('Japanese', 'Basic')]: ['Meaning'],
			},
		});
		await tab.sync('Japanese', 'Basic');

		const before = settings.length;
		await latestRow('Meaning')?.extraButtons[0]?.click();

		const key = fieldConfigKey('Japanese', 'Basic');
		expect(plugin.settings.generateWithAiFields[key]).toEqual([]);
		// Removed: no *new* row named Meaning appears in the render that followed —
		// latestRow() alone can't tell "removed" from "never re-rendered".
		expect(settings.slice(before).some((s) => s.name === 'Meaning')).toBe(
			false,
		);
		expect(latestDropdown()?.optionOrder).toEqual(['', 'Meaning']);
	});

	it('does not re-fetch fields when the pair has not changed', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		const { tab } = setup();

		await tab.sync('Japanese', 'Basic');
		await tab.sync('Japanese', 'Basic');

		expect(modelFieldNames).toHaveBeenCalledTimes(1);
	});

	it('re-fetches and resets added fields when the pair changes', async () => {
		modelFieldNames.mockResolvedValueOnce(['Word', 'Meaning']);
		const { tab } = setup({
			generateWithAiFields: {
				[fieldConfigKey('Japanese', 'Basic')]: ['Meaning'],
			},
		});
		await tab.sync('Japanese', 'Basic');
		expect(latestRow('Meaning')).toBeDefined();

		modelFieldNames.mockResolvedValueOnce(['Front', 'Back']);
		await tab.sync('Japanese', 'Cloze');

		expect(modelFieldNames).toHaveBeenLastCalledWith('Cloze');
		expect(latestDropdown()?.optionOrder).toEqual(['', 'Back']);
	});

	it('drops a slow response for a pair that is no longer current', async () => {
		let resolveSlow!: (v: string[]) => void;
		modelFieldNames
			.mockReturnValueOnce(new Promise<string[]>((r) => (resolveSlow = r)))
			.mockResolvedValueOnce(['Front', 'Back']);
		const { tab } = setup();

		const slow = tab.sync('Japanese', 'Basic');
		await tab.sync('Spanish', 'Cloze');
		resolveSlow(['Stale']);
		await slow;

		expect(latestDropdown()?.optionOrder).toEqual(['', 'Back']);
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
			const ctx = setup({
				generateWithAiFields: {
					[fieldConfigKey('Japanese', 'Basic')]: ['Meaning'],
				},
			});
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
			expect(generateDraft).not.toHaveBeenCalled();
		});

		it('fills an editable preview per added field, without writing to the note', async () => {
			planGenerate.mockResolvedValue(plan);
			generateDraft.mockResolvedValue({ Meaning: 'medicine' });
			const { generate } = await ready();

			await generate.click();
			await flush();

			expect(generateDraft).toHaveBeenCalledWith(plan);
			expect(applyGenerated).not.toHaveBeenCalled();
			expect(latestRow('Meaning')?.textArea?.value).toBe('medicine');
			expect(generate.children[1]?.text).toBe('✅ Done!');
		});

		it('a second Generate replaces the previous draft (full regenerate)', async () => {
			vi.useFakeTimers();
			try {
				planGenerate.mockResolvedValue(plan);
				generateDraft.mockResolvedValue({ Meaning: 'first' });
				const { generate } = await ready();
				await generate.click();
				await vi.advanceTimersByTimeAsync(0);
				// The button's own ✅ Done! → normal restore is on a 2s timeout — let it
				// finish so a second click isn't a no-op while still "busy".
				await vi.advanceTimersByTimeAsync(2000);

				generateDraft.mockResolvedValue({ Meaning: 'second' });
				await generate.click();
				await vi.advanceTimersByTimeAsync(0);

				expect(latestRow('Meaning')?.textArea?.value).toBe('second');
			} finally {
				vi.useRealTimers();
			}
		});

		it('is not re-enabled by sync() while a generation is running', async () => {
			planGenerate.mockResolvedValue(plan);
			let finish: (v: unknown) => void = () => {};
			generateDraft.mockReturnValue(new Promise((r) => (finish = r)));
			const { generate, tab } = await ready();

			await generate.click();
			await flush();
			expect(generate.children[1]?.text).toBe('⏳ Generating...');
			await tab.sync('Japanese', 'Basic');
			expect(generate.disabled).toBe(true);

			finish({});
			await flush();
		});

		it('surfaces a ProviderError message', async () => {
			const { ProviderError } = await import('../../types');
			planGenerate.mockResolvedValue(plan);
			generateDraft.mockRejectedValue(
				new ProviderError('anthropic', 'HTTP 401 from https://x'),
			);
			const { generate } = await ready();

			await generate.click();
			await flush();

			expect(toastError).toHaveBeenCalledWith(
				'❌ anthropic: HTTP 401 from https://x',
			);
			expect(Notice).not.toHaveBeenCalledWith(
				'The text model returned nothing to add. Try again or check the model.',
			);
		});

		it('tells the user when the model returned nothing usable', async () => {
			planGenerate.mockResolvedValue(plan);
			generateDraft.mockResolvedValue({ Meaning: '' });
			const { generate } = await ready();

			await generate.click();
			await flush();

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

	describe('Write button', () => {
		const plan = { provider: {}, word: 'w', targetFields: ['Meaning'] };

		async function readyWithDraft(draft = 'medicine') {
			modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
			const ctx = setup({
				generateWithAiFields: {
					[fieldConfigKey('Japanese', 'Basic')]: ['Meaning'],
				},
			});
			await ctx.tab.sync('Japanese', 'Basic');
			planGenerate.mockResolvedValue(plan);
			generateDraft.mockResolvedValue({ Meaning: draft });
			await ctx.generate.click();
			await flush();
			return ctx;
		}

		it('shows a Notice and never calls applyGenerated when there is nothing to write', async () => {
			const { write } = await readyWithDraft('');

			await write.click();
			await flush();

			expect(Notice).toHaveBeenCalledWith('Generate content first.');
			expect(applyGenerated).not.toHaveBeenCalled();
		});

		it('writes the edited text, not the original AI output', async () => {
			const { write } = await readyWithDraft('medicine');
			applyGenerated.mockResolvedValue({ filled: ['Meaning'], skipped: [] });

			await latestRow('Meaning')?.textArea?.edit('edited by hand');
			await write.click();
			await flush();

			expect(applyGenerated).toHaveBeenCalledWith(
				expect.anything(),
				note,
				{ Meaning: 'edited by hand' },
			);
			expect(toastSuccess).toHaveBeenCalledWith(
				'✅ AI content generated: 1 filled.',
			);
			expect(write.children[1]?.text).toBe('✅ Done!');
		});

		it('clears the draft after a successful write', async () => {
			const { write } = await readyWithDraft('medicine');
			applyGenerated.mockResolvedValue({ filled: ['Meaning'], skipped: [] });

			await write.click();
			await flush();

			expect(latestRow('Meaning')?.textArea).toBeUndefined();
		});

		it('keeps the draft when the write fails', async () => {
			const { write } = await readyWithDraft('medicine');
			applyGenerated.mockRejectedValue(new Error('boom'));

			await write.click();
			await flush();

			expect(toastError).toHaveBeenCalledWith(
				'❌ Failed to write to the note.',
			);
			expect(latestRow('Meaning')?.textArea?.value).toBe('medicine');
		});

		it('does nothing while disabled', async () => {
			const { write } = setup();

			await write.click();
			await flush();

			expect(applyGenerated).not.toHaveBeenCalled();
		});
	});
});
