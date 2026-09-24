import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../../main';
import {
	examplesKey,
	fieldConfigKey,
	type AnkiBridgeSettings,
} from '../../settings';
import { FakeEl } from '../../test/fakeDom';

class FakeMenuItem {
	title = '';
	private cb: (() => unknown) | null = null;
	setTitle(t: string) {
		this.title = t;
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

// "Add field" opens a Menu instead of a <select> — one FakeMenu is created per click;
// tests grab the latest one via the offeredFields()/addFieldViaMenu() helpers below.
class FakeMenu {
	items: FakeMenuItem[] = [];
	addItem(cb: (item: FakeMenuItem) => unknown) {
		const item = new FakeMenuItem();
		cb(item);
		this.items.push(item);
		return this;
	}
	showAtMouseEvent() {
		return this;
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
	extraButtons: FakeExtraButton[] = [];
	textArea?: FakeTextArea;
	setName(n: string) {
		this.name = n;
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

const { Notice, setIcon, settings, menus } = vi.hoisted(() => ({
	Notice: vi.fn(function () {
		return { hide: vi.fn() };
	}),
	setIcon: vi.fn(),
	settings: [] as FakeSetting[],
	menus: [] as FakeMenu[],
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
	Menu: class {
		constructor() {
			const m = new FakeMenu();
			menus.push(m);
			return m;
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
	menus.length = 0;
});

// Settings are re-created on every render without clearing old ones (they live on a
// fake, not real DOM) — the freshest one for a given name/kind is always the current
// render's, same convention as settingsTab.test.ts's `latest()`.
function latestRow(name: string): FakeSetting | undefined {
	return [...settings].reverse().find((s) => s.name === name);
}

// Clicks "Add field" and returns the field names offered in the Menu that opens.
async function offeredFields(addField: FakeEl): Promise<string[]> {
	await addField.click();
	const menu = menus[menus.length - 1];
	return menu?.items.map((i) => i.title) ?? [];
}

// Clicks "Add field", then picks the given field from the Menu that opens.
async function addFieldViaMenu(addField: FakeEl, field: string): Promise<void> {
	await addField.click();
	const menu = menus[menus.length - 1];
	const item = menu?.items.find((i) => i.title === field);
	await item?.click();
}

function setup(overrides: Partial<AnkiBridgeSettings> = {}) {
	const parent = new FakeEl();
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: {
			ankiConnectUrl: '',
			generateWithAiFields: {},
			generateExamples: {},
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
	const addField = actions[2] as FakeEl;
	const clear = actions[3] as FakeEl;
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
		addField,
		clear,
		fieldsEl,
	};
}

describe('renderTextTab', () => {
	it('renders Generate, Write, Add field and Clear on one row (icon + text), all disabled, title below', () => {
		const { parent, generate, write, addField, clear } = setup();

		const row = parent.byClass('anki-bridge-sidebar__actions')[0];
		expect(row?.children.map((c) => c.tag)).toEqual([
			'button',
			'button',
			'button',
			'button',
		]);
		expect(generate.children[1]?.text).toBe('Generate');
		expect(write.children[1]?.text).toBe('Write');
		expect(addField.children[1]?.text).toBe('Add field');
		expect(setIcon.mock.calls[0]?.[1]).toBe('sparkles');
		expect(setIcon.mock.calls[1]?.[1]).toBe('save');
		expect(setIcon.mock.calls[2]?.[1]).toBe('plus');
		expect(clear.children[1]?.text).toBe('Clear');
		expect(setIcon.mock.calls[3]?.[1]).toBe('eraser');
		expect(clear.disabled).toBe(true);
		expect(generate.disabled).toBe(true);
		expect(write.disabled).toBe(true);
		expect(addField.disabled).toBe(true);

		const title = parent.byClass('anki-bridge-sidebar__section-title')[0];
		expect(title?.text).toBe('Fields to generate with AI');
	});

	it('shows a hint and keeps all three buttons disabled until the note has Deck and Model', async () => {
		const { tab, generate, write, addField, fieldsEl } = setup();

		await tab.sync('Japanese', '');

		expect(modelFieldNames).not.toHaveBeenCalled();
		expect(fieldsEl.children[0]?.text).toBe(
			'Set a Deck and Model above first.',
		);
		expect(generate.disabled).toBe(true);
		expect(write.disabled).toBe(true);
		expect(addField.disabled).toBe(true);
	});

	it('does nothing when Add field is clicked while disabled', async () => {
		const { addField } = setup();

		await addField.click();

		expect(menus).toHaveLength(0);
	});

	it('offers every field but the Main Field to add, and enables all three buttons', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		const { tab, generate, write, addField } = setup({
			mainFieldConfig: { [fieldConfigKey('Japanese', 'Basic')]: 'Word' },
		});

		await tab.sync('Japanese', 'Basic');

		expect(modelFieldNames).toHaveBeenCalledWith('Basic');
		expect(addField.disabled).toBe(false);
		expect(await offeredFields(addField)).toEqual(['Meaning', 'Furigana']);
		expect(generate.disabled).toBe(false);
		expect(write.disabled).toBe(false);
	});

	it('restores fields already added for that Deck+Model pair only, excluding the Main Field', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		const { tab, addField } = setup({
			generateWithAiFields: {
				[fieldConfigKey('Japanese', 'Basic')]: ['Word', 'Furigana'],
				[fieldConfigKey('Spanish', 'Cloze')]: ['Meaning'],
			},
			mainFieldConfig: { [fieldConfigKey('Japanese', 'Basic')]: 'Word' },
		});

		await tab.sync('Japanese', 'Basic');

		expect(latestRow('Furigana')).toBeDefined();
		expect(latestRow('Word')).toBeUndefined(); // Main Field, never addable
		expect(latestRow('Meaning')).toBeUndefined(); // belongs to a different pair
		// Already-added fields are no longer offered in the menu.
		expect(await offeredFields(addField)).toEqual(['Meaning']);
	});

	it('adding a field persists it and removes it from the menu', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		const { tab, plugin, saveSettings, addField } = setup({
			mainFieldConfig: { [fieldConfigKey('Japanese', 'Basic')]: 'Word' },
		});
		await tab.sync('Japanese', 'Basic');

		await addFieldViaMenu(addField, 'Meaning');

		const key = fieldConfigKey('Japanese', 'Basic');
		expect(plugin.settings.generateWithAiFields[key]).toEqual(['Meaning']);
		expect(saveSettings).toHaveBeenCalledTimes(1);
		expect(latestRow('Meaning')).toBeDefined();
		expect(await offeredFields(addField)).toEqual(['Furigana']);
	});

	it('removing a field persists it and drops its draft', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning']);
		const { tab, plugin, addField } = setup({
			generateWithAiFields: {
				[fieldConfigKey('Japanese', 'Basic')]: ['Meaning'],
			},
			mainFieldConfig: { [fieldConfigKey('Japanese', 'Basic')]: 'Word' },
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
		expect(await offeredFields(addField)).toEqual(['Meaning']);
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
		const { tab, addField } = setup({
			generateWithAiFields: {
				[fieldConfigKey('Japanese', 'Basic')]: ['Meaning'],
			},
			mainFieldConfig: {
				[fieldConfigKey('Japanese', 'Basic')]: 'Word',
				[fieldConfigKey('Japanese', 'Cloze')]: 'Front',
			},
		});
		await tab.sync('Japanese', 'Basic');
		expect(latestRow('Meaning')).toBeDefined();

		modelFieldNames.mockResolvedValueOnce(['Front', 'Back']);
		await tab.sync('Japanese', 'Cloze');

		expect(modelFieldNames).toHaveBeenLastCalledWith('Cloze');
		expect(await offeredFields(addField)).toEqual(['Back']);
	});

	it('drops a slow response for a pair that is no longer current', async () => {
		let resolveSlow!: (v: string[]) => void;
		modelFieldNames
			.mockReturnValueOnce(
				new Promise<string[]>((r) => (resolveSlow = r)),
			)
			.mockResolvedValueOnce(['Front', 'Back']);
		const { tab, addField } = setup({
			mainFieldConfig: { [fieldConfigKey('Spanish', 'Cloze')]: 'Front' },
		});

		const slow = tab.sync('Japanese', 'Basic');
		await tab.sync('Spanish', 'Cloze');
		resolveSlow(['Stale']);
		await slow;

		expect(await offeredFields(addField)).toEqual(['Back']);
	});

	it('refresh() re-reads Main Field for the same pair, unlike sync() which dedupes', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
		const key = fieldConfigKey('Japanese', 'Basic');
		const { tab, plugin, addField } = setup({
			mainFieldConfig: { [key]: 'Word' },
		});
		await tab.sync('Japanese', 'Basic');
		expect(await offeredFields(addField)).toEqual(['Meaning', 'Furigana']);

		// Main Field changes for the same pair (sidebar's Main Field dropdown) — a
		// plain sync() would no-op here since the pair itself didn't change.
		plugin.settings.mainFieldConfig[key] = 'Meaning';
		await tab.refresh('Japanese', 'Basic');

		expect(await offeredFields(addField)).toEqual(['Word', 'Furigana']);
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
		const plan = {
			provider: {},
			word: 'w',
			targetFields: ['Meaning'],
			context: { targetLanguage: 'English' },
		};

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

		it('shows an unrecognized AnkiConnectError’s own message instead of the generic one', async () => {
			const { AnkiConnectError } = await import('../../types');
			planGenerate.mockRejectedValue(
				new AnkiConnectError(
					'modelFieldNames',
					'some Anki-side message',
				),
			);
			const { generate } = await ready();

			await generate.click();
			await flush();

			expect(toastError).toHaveBeenCalledWith(
				"❌ AnkiConnect 'modelFieldNames' failed: some Anki-side message",
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
		const plan = {
			provider: {},
			word: 'w',
			targetFields: ['Meaning'],
			context: { targetLanguage: 'English' },
		};

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
			applyGenerated.mockResolvedValue({
				filled: ['Meaning'],
				skipped: [],
			});

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

		it('remembers the written card as a Generate example for this pair', async () => {
			const { write, plugin, saveSettings } =
				await readyWithDraft('medicine');
			applyGenerated.mockResolvedValue({
				filled: ['Meaning'],
				skipped: [],
			});

			await latestRow('Meaning')?.textArea?.edit('edited by hand');
			await write.click();
			await flush();

			expect(
				plugin.settings.generateExamples[
					examplesKey('Japanese', 'Basic', 'English')
				],
			).toEqual([{ word: 'w', fields: { Meaning: 'edited by hand' } }]);
			expect(saveSettings).toHaveBeenCalled();
		});

		it('clears the draft after a successful write', async () => {
			const { write } = await readyWithDraft('medicine');
			applyGenerated.mockResolvedValue({
				filled: ['Meaning'],
				skipped: [],
			});

			await write.click();
			await flush();

			expect(latestRow('Meaning')?.textArea).toBeUndefined();
		});

		it('Clear drops every preview without touching the note', async () => {
			const { write, clear } = await readyWithDraft('medicine');
			expect(clear.disabled).toBe(false);

			await clear.click();
			await flush();

			expect(latestRow('Meaning')?.textArea).toBeUndefined();
			expect(clear.disabled).toBe(true);
			await write.click();
			await flush();
			expect(Notice).toHaveBeenCalledWith('Generate content first.');
			expect(applyGenerated).not.toHaveBeenCalled();
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
