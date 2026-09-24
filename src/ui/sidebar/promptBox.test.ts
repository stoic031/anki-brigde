import { describe, expect, it, vi } from 'vitest';
import type VocabWeavePlugin from '../../main';
import { defaultInstruction } from '../../providers/text/prompt';
import { DEFAULT_SETTINGS, examplesKey, fieldConfigKey } from '../../settings';
import { FakeEl } from '../../test/fakeDom';

vi.mock('obsidian', () => ({ setIcon: vi.fn() }));

import { renderPromptBox } from './promptBox';

const key = fieldConfigKey('D', 'M');

function setup() {
	const parent = new FakeEl();
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: structuredClone(DEFAULT_SETTINGS),
		saveSettings,
	} as unknown as VocabWeavePlugin;
	const box = renderPromptBox(parent as unknown as HTMLElement, plugin);
	const details = parent.children[0] as FakeEl;
	const badge = () => parent.byClass('vocabweave-sidebar__badge')[0];
	const area = () => parent.findAll((el) => el.tag === 'textarea')[0];
	const reset = () => parent.byClass('vocabweave-sidebar__prompt-reset')[0];
	const hint = () => parent.byClass('vocabweave-sidebar__hint')[0]?.text;
	return { box, plugin, saveSettings, details, badge, area, reset, hint };
}

describe('renderPromptBox', () => {
	it('is collapsed, and hidden until the note has Deck and Model', () => {
		const { box, details } = setup();

		box.render('', '', 0);
		expect(details.tag).toBe('details');
		expect(details.attrs.open).toBeUndefined();
		expect(details.hidden).toBe(true);

		box.render('D', 'M', 2);
		expect(details.hidden).toBe(false);
	});

	it('shows the default instruction with a Default badge and no Reset', () => {
		const { box, badge, area, reset } = setup();

		box.render('D', 'M', 2);

		expect(badge()?.text).toBe('Default');
		expect(area()?.value).toBe(defaultInstruction('extract-vocabulary'));
		expect(reset()).toBeUndefined();
	});

	it('saves an edit for this pair and flips the badge to Custom', async () => {
		const { box, plugin, saveSettings, badge, area, reset } = setup();
		box.render('D', 'M', 2);

		(area() as FakeEl).value = '  Be funny.  ';
		await area()?.trigger('change');

		expect(plugin.settings.textInstructions).toEqual({
			[key]: 'Be funny.',
		});
		expect(saveSettings).toHaveBeenCalled();
		expect(badge()?.text).toBe('Custom');
		expect(reset()).toBeDefined();
	});

	it('stores nothing when the text is blank or equals the default', async () => {
		const { box, plugin, area } = setup();
		plugin.settings.textInstructions[key] = 'old';
		box.render('D', 'M', 2);

		(area() as FakeEl).value =
			`${defaultInstruction('extract-vocabulary')}\n`;
		await area()?.trigger('change');
		expect(plugin.settings.textInstructions).toEqual({});

		plugin.settings.textInstructions[key] = 'old';
		box.render('D', 'M', 2);
		(area() as FakeEl).value = '   ';
		await area()?.trigger('change');
		expect(plugin.settings.textInstructions).toEqual({});
	});

	it('Reset drops the custom instruction', async () => {
		const { box, plugin, badge, area, reset } = setup();
		plugin.settings.textInstructions[key] = 'Be funny.';
		box.render('D', 'M', 2);
		expect(area()?.value).toBe('Be funny.');

		await reset()?.click();

		expect(plugin.settings.textInstructions).toEqual({});
		expect(badge()?.text).toBe('Default');
		expect(area()?.value).toBe(defaultInstruction('extract-vocabulary'));
	});

	it('lists only the parts that will actually be sent', () => {
		const { box, plugin, hint } = setup();

		box.render('D', 'M', 1);
		expect(hint()).toBe(
			'Also sent automatically: JSON format for 1 field.',
		);

		plugin.settings.profiles = [
			{ ...DEFAULT_SETTINGS.profiles[0]!, targetLanguage: 'Japanese' },
		];
		plugin.settings.nativeLanguage = 'Vietnamese';
		plugin.settings.generateExamples[examplesKey('D', 'M', 'Japanese')] = [
			{ word: 'a', fields: {} },
			{ word: 'b', fields: {} },
		];
		box.render('D', 'M', 3);
		expect(hint()).toBe(
			'Also sent automatically: Learning language (Japanese), your language (Vietnamese), 2 approved cards as examples, JSON format for 3 fields.',
		);
	});
});
