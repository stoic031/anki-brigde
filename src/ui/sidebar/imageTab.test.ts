import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type VocabWeavePlugin from '../../main';
import {
	fieldConfigKey,
	type VocabWeaveSettings,
	type ImageFieldConfig,
} from '../../settings';
import { FakeEl } from '../../test/fakeDom';

class FakeDropdown {
	options: Record<string, string> = {};
	value = '';
	private cb: ((v: string) => unknown) | null = null;
	addOptions(o: Record<string, string>) {
		this.options = o;
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
	async trigger(v: string) {
		this.value = v;
		await this.cb?.(v);
	}
}

class FakeSetting {
	name = '';
	dropdown = new FakeDropdown();
	setName(n: string) {
		this.name = n;
		return this;
	}
	addDropdown(cb: (d: FakeDropdown) => unknown) {
		cb(this.dropdown);
		return this;
	}
}

const { Notice, setIcon, settings } = vi.hoisted(() => ({
	Notice: vi.fn(function () {
		return { hide: vi.fn(), setMessage: vi.fn() };
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

const { planAddImage, runAddImage, writeImagePrompt } = vi.hoisted(() => ({
	planAddImage: vi.fn(),
	runAddImage: vi.fn(),
	writeImagePrompt: vi.fn(),
}));
vi.mock('../../note/addImage', () => ({
	planAddImage,
	runAddImage,
	writeImagePrompt,
}));

let note = { path: 'a.md' };
const flush = () => new Promise((r) => setTimeout(r, 0));

import { renderImageTab } from './imageTab';

beforeEach(() => {
	// runAction schedules its restore with window.setTimeout; Node has no `window`.
	vi.stubGlobal('window', globalThis);
});

afterEach(() => {
	note = { path: 'a.md' };
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	settings.length = 0;
});

function setup(imageConfigs: Record<string, ImageFieldConfig> = {}) {
	const parent = new FakeEl();
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: { ankiConnectUrl: '', imageConfigs } as VocabWeaveSettings,
		saveSettings,
	} as unknown as VocabWeavePlugin;
	const tab = renderImageTab(
		parent as unknown as HTMLElement,
		plugin,
		() => note as never,
	);
	const addImage = parent.byClass('vocabweave-sidebar__action')[0] as FakeEl;
	const writePrompt = parent.byClass(
		'vocabweave-sidebar__action',
	)[1] as FakeEl;
	const promptEl = parent.byClass('vocabweave-sidebar__prompt')[0] as FakeEl;
	const promptArea = () => promptEl.findAll((el) => el.tag === 'textarea')[0];
	const promptStatus = () =>
		promptEl.byClass('vocabweave-sidebar__hint')[0]?.text;
	const rows = () => settings as FakeSetting[];
	const lastRow = () => rows()[rows().length - 1];
	return {
		parent,
		plugin,
		tab,
		saveSettings,
		addImage,
		writePrompt,
		promptEl,
		promptArea,
		promptStatus,
		rows,
		lastRow,
	};
}

describe('renderImageTab', () => {
	it('renders the title with Add image and Write prompt (icon + text) next to it', () => {
		const { parent, addImage, writePrompt, promptEl } = setup();

		const header = parent.byClass('vocabweave-sidebar__section-header')[0];
		expect(header?.children.map((c) => c.text || c.tag)).toEqual([
			'Image field mapping',
			'button',
			'button',
		]);
		expect(addImage.children[1]?.text).toBe('Add image');
		expect(writePrompt.children[1]?.text).toBe('Write prompt');
		expect(
			setIcon.mock.calls.map((c: unknown[]) => c[1] as string),
		).toEqual(['image', 'pencil-line']);
		expect(addImage.disabled).toBe(true);
		expect(writePrompt.disabled).toBe(true);
		expect(promptEl.hidden).toBe(true);
	});

	it('shows a hint and loads no fields until the note has Deck and Model', async () => {
		const { parent, tab, rows } = setup();

		await tab.sync('', '');

		expect(modelFieldNames).not.toHaveBeenCalled();
		expect(rows()).toHaveLength(0);
		expect(parent.byClass('vocabweave-sidebar__hint')[0]?.text).toBe(
			'Set a deck and model above first.',
		);
	});

	it('renders On existing tag then Output field, defaulting to Append and no field', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Image']);
		const { tab, rows } = setup();

		await tab.sync('Japanese', 'Basic');

		expect(rows().map((r) => r.name)).toEqual([
			'On existing tag',
			'Output field',
		]);
		expect(rows()[0]?.dropdown.value).toBe('append');
		expect(rows()[1]?.dropdown.value).toBe('');
		expect(Object.keys(rows()[1]?.dropdown.options ?? {})).toEqual([
			'',
			'Word',
			'Image',
		]);
	});

	it('restores the config saved for this pair', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Image']);
		const { tab, rows } = setup({
			[fieldConfigKey('Japanese', 'Basic')]: {
				outputField: 'Image',
				onExisting: 'overwrite',
			},
		});

		await tab.sync('Japanese', 'Basic');

		expect(rows()[0]?.dropdown.value).toBe('overwrite');
		expect(rows()[1]?.dropdown.value).toBe('Image');
	});

	it('saves the chosen Output field and mode for the pair', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Image']);
		const { tab, rows, plugin, saveSettings } = setup();
		await tab.sync('Japanese', 'Basic');

		await rows()[1]?.dropdown.trigger('Image');
		await rows()[0]?.dropdown.trigger('overwrite');

		expect(
			plugin.settings.imageConfigs[fieldConfigKey('Japanese', 'Basic')],
		).toEqual({ outputField: 'Image', onExisting: 'overwrite' });
		expect(saveSettings).toHaveBeenCalledTimes(2);
	});

	it('shows a saved Output field the model no longer has as unselected', async () => {
		modelFieldNames.mockResolvedValue(['Word']);
		const { tab, rows } = setup({
			[fieldConfigKey('Japanese', 'Basic')]: {
				outputField: 'Gone',
				onExisting: 'append',
			},
		});

		await tab.sync('Japanese', 'Basic');

		expect(rows()[1]?.dropdown.value).toBe('');
	});

	it('does not reload fields when the pair has not changed', async () => {
		modelFieldNames.mockResolvedValue(['Word']);
		const { tab } = setup();

		await tab.sync('Japanese', 'Basic');
		await tab.sync('Japanese', 'Basic');

		expect(modelFieldNames).toHaveBeenCalledTimes(1);
	});

	it('keeps each pair’s config separate when the note changes', async () => {
		modelFieldNames.mockResolvedValue(['Word', 'Image']);
		const { tab, lastRow } = setup({
			[fieldConfigKey('Japanese', 'Basic')]: {
				outputField: 'Image',
				onExisting: 'append',
			},
		});
		await tab.sync('Japanese', 'Basic');

		await tab.sync('Spanish', 'Cloze');

		expect(lastRow()?.dropdown.value).toBe('');
	});

	it('toasts an error when AnkiConnect is unreachable', async () => {
		modelFieldNames.mockRejectedValue(new Error('offline'));
		const { tab, rows } = setup();

		await tab.sync('Japanese', 'Basic');

		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to load fields. Please check Anki connection.',
		);
		expect(rows()).toHaveLength(0);
	});

	it('drops a field list that arrives after the note already changed', async () => {
		let resolveFirst: (f: string[]) => void = () => undefined;
		modelFieldNames.mockReturnValueOnce(
			new Promise<string[]>((r) => {
				resolveFirst = r;
			}),
		);
		modelFieldNames.mockResolvedValueOnce(['Other']);
		const { tab, rows, lastRow } = setup();

		const first = tab.sync('Japanese', 'Basic');
		await tab.sync('Spanish', 'Cloze');
		resolveFirst(['Word']);
		await first;

		expect(Object.keys(lastRow()?.dropdown.options ?? {})).toEqual([
			'',
			'Other',
		]);
		expect(rows()).toHaveLength(2);
	});

	describe('Add image button', () => {
		const plan = {
			textProvider: {},
			imageProvider: {},
			fieldsInput: 'Word: 診察',
			word: '診察',
			outputField: 'Image',
			onExisting: 'append' as const,
		};

		async function ready() {
			modelFieldNames.mockResolvedValue(['Word', 'Image']);
			const ctx = setup();
			await ctx.tab.sync('Japanese', 'Basic');
			return ctx;
		}

		it('is enabled once Deck and Model are set', async () => {
			const { addImage } = await ready();

			expect(addImage.disabled).toBe(false);
		});

		it('shows the reason as a Notice when the plan says stop, and never runs', async () => {
			planAddImage.mockResolvedValue({
				stop: 'Please configure Image field mapping for this Deck/Model in the sidebar (Image tab) first.',
			});
			const { addImage } = await ready();

			await addImage.click();
			await flush();

			expect(Notice).toHaveBeenCalledWith(
				'Please configure Image field mapping for this Deck/Model in the sidebar (Image tab) first.',
			);
			expect(runAddImage).not.toHaveBeenCalled();
		});

		it('runs the plan and cycles the button to Done', async () => {
			planAddImage.mockResolvedValue(plan);
			runAddImage.mockResolvedValue({
				filename: '_obsidian_x_image_1.png',
				prompt: 'p',
			});
			const { addImage } = await ready();

			await addImage.click();
			await flush();

			expect(runAddImage).toHaveBeenCalledWith(
				expect.anything(),
				note,
				plan,
				'',
				expect.any(Function),
			);
			expect(addImage.children[1]?.text).toBe('✅ Done!');
			expect(toastSuccess).toHaveBeenCalledWith('🖼️ Image added to note');
		});

		it('is not re-enabled by sync() while a run is in progress', async () => {
			planAddImage.mockResolvedValue(plan);
			let finish: (v: unknown) => void = () => {};
			runAddImage.mockReturnValue(new Promise((r) => (finish = r)));
			const { addImage, tab } = await ready();

			await addImage.click();
			await flush();
			expect(addImage.children[1]?.text).toBe('⏳ Generating...');
			await tab.sync('Japanese', 'Basic');
			expect(addImage.disabled).toBe(true);

			finish({ filename: 'x.png' });
			await flush();
		});

		it('surfaces a ProviderError message', async () => {
			const { ProviderError } = await import('../../types');
			planAddImage.mockResolvedValue(plan);
			runAddImage.mockRejectedValue(
				new ProviderError('pollinations', 'HTTP 500 from https://x'),
			);
			const { addImage } = await ready();

			await addImage.click();
			await flush();

			expect(toastError).toHaveBeenCalledWith(
				'❌ pollinations: HTTP 500 from https://x',
			);
			expect(toastSuccess).not.toHaveBeenCalled();
		});

		it('surfaces a thrown ProviderError from building the image provider', async () => {
			const { ProviderError } = await import('../../types');
			planAddImage.mockRejectedValue(
				new ProviderError(
					'comfyui',
					'no adapter for this provider type',
				),
			);
			const { addImage } = await ready();

			await addImage.click();
			await flush();

			expect(toastError).toHaveBeenCalledWith(
				'❌ comfyui: no adapter for this provider type',
			);
			expect(runAddImage).not.toHaveBeenCalled();
		});

		it('falls back to a generic Anki-connection error for anything else', async () => {
			planAddImage.mockRejectedValue(new Error('boom'));
			const { addImage } = await ready();

			await addImage.click();
			await flush();

			expect(toastError).toHaveBeenCalledWith(
				'❌ Failed to add image. Please check Anki connection.',
			);
		});

		it('shows an unrecognized AnkiConnectError’s own message instead of the generic one', async () => {
			const { AnkiConnectError } = await import('../../types');
			planAddImage.mockRejectedValue(
				new AnkiConnectError(
					'modelFieldNames',
					'some Anki-side message',
				),
			);
			const { addImage } = await ready();

			await addImage.click();
			await flush();

			expect(toastError).toHaveBeenCalledWith(
				"❌ AnkiConnect 'modelFieldNames' failed: some Anki-side message",
			);
		});

		it('does nothing while disabled', async () => {
			const { addImage } = setup();

			await addImage.click();
			await flush();

			expect(planAddImage).not.toHaveBeenCalled();
		});
	});

	describe('Image prompt', () => {
		const plan = {
			textProvider: {},
			imageProvider: {},
			fieldsInput: 'Word: 診察',
			word: '診察',
			outputField: 'Image',
			onExisting: 'append' as const,
		};

		async function ready() {
			modelFieldNames.mockResolvedValue(['Word', 'Image']);
			planAddImage.mockResolvedValue(plan);
			const ctx = setup();
			await ctx.tab.sync('Japanese', 'Basic');
			return ctx;
		}

		it('Write prompt shows the text model’s prompt without drawing', async () => {
			writeImagePrompt.mockResolvedValue('a doctor examining a patient');
			const { writePrompt, promptEl, promptArea, promptStatus } =
				await ready();

			await writePrompt.click();
			await flush();

			expect(writeImagePrompt).toHaveBeenCalledWith(plan);
			expect(runAddImage).not.toHaveBeenCalled();
			expect(promptEl.hidden).toBe(false);
			expect(promptArea()?.value).toBe('a doctor examining a patient');
			expect(promptStatus()).toContain('Written by the text model');
		});

		it('Add image draws the edited prompt as-is', async () => {
			writeImagePrompt.mockResolvedValue('draft');
			runAddImage.mockResolvedValue({
				filename: 'x.png',
				prompt: 'mine',
			});
			const { writePrompt, addImage, promptArea, promptStatus } =
				await ready();
			await writePrompt.click();
			await flush();

			const area = promptArea() as FakeEl;
			area.value = 'mine';
			await area.trigger('input');
			expect(promptStatus()).toContain('Edited');

			await new Promise((r) => setTimeout(r, 2100)); // Write prompt's ✅ restore
			await addImage.click();
			await flush();

			expect(runAddImage.mock.calls[0]?.[3]).toBe('mine');
			expect(promptStatus()).toContain('Used for the last image');
		});

		it('Add image with no prompt shows the one the text model wrote', async () => {
			runAddImage.mockImplementation(
				async (_p, _n, _plan, _given, onBuilt: (p: string) => void) => {
					onBuilt('auto prompt');
					return { filename: 'x.png', prompt: 'auto prompt' };
				},
			);
			const { addImage, promptArea, promptStatus } = await ready();

			await addImage.click();
			await flush();

			expect(runAddImage.mock.calls[0]?.[3]).toBe('');
			expect(promptArea()?.value).toBe('auto prompt');
			expect(promptStatus()).toContain('Used for the last image');
		});

		it('is dropped when the active note changes, and by the discard button', async () => {
			writeImagePrompt.mockResolvedValue('p');
			const { writePrompt, tab, promptEl } = await ready();
			await writePrompt.click();
			await flush();

			await tab.sync('Japanese', 'Basic');
			expect(promptEl.hidden).toBe(false);

			note = { path: 'b.md' };
			await tab.sync('Japanese', 'Basic');
			expect(promptEl.hidden).toBe(true);

			note = { path: 'a.md' };
			await new Promise((r) => setTimeout(r, 2100));
			await writePrompt.click();
			await flush();
			const discard = promptEl.findAll(
				(el) => el.attrs['aria-label'] === 'Discard prompt',
			)[0];
			await discard?.click();
			expect(promptEl.hidden).toBe(true);
		});
	});
});
