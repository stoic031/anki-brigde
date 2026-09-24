import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFile } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_SETTINGS, examplesKey, fieldConfigKey } from '../settings';
import { ProviderError } from '../types';
import { applyGenerated, generateDraft, planGenerate } from './generateFields';

const note = { path: 'a.md' } as TFile;
const provider = { id: 'p', isCloud: false, processText: vi.fn() };

function setup(
	opts: {
		content?: string;
		ticked?: string[];
		provider?: unknown;
		mainField?: string | null; // null = leave unconfigured
		targetLanguage?: string; // adds a selected profile with this Learning language
		nativeLanguage?: string;
	} = {},
) {
	let content =
		opts.content ?? '## Word\n薬\n\n## Meaning\n\n## Furigana\n\n';
	const process = vi.fn(async (_f: TFile, fn: (c: string) => string) => {
		content = fn(content);
	});
	const mainField = opts.mainField === undefined ? 'Word' : opts.mainField;
	const plugin = {
		settings: {
			...structuredClone(DEFAULT_SETTINGS),
			profiles: opts.targetLanguage
				? [
						{
							id: 'p',
							name: 'P',
							deck: 'D',
							model: 'M',
							folder: '',
							mainField: '',
							targetLanguage: opts.targetLanguage,
						},
					]
				: DEFAULT_SETTINGS.profiles,
			activeProfileId: opts.targetLanguage
				? 'p'
				: DEFAULT_SETTINGS.activeProfileId,
			generateWithAiFields: {
				[fieldConfigKey('D', 'M')]: opts.ticked ?? [
					'Meaning',
					'Furigana',
				],
			},
			mainFieldConfig: mainField
				? { [fieldConfigKey('D', 'M')]: mainField }
				: {},
			nativeLanguage: opts.nativeLanguage ?? '',
		},
		providers: {
			getTextProvider: () =>
				opts.provider === undefined ? provider : opts.provider,
		},
		app: {
			vault: {
				read: vi.fn(() => Promise.resolve(content)),
				process,
			},
		},
	} as unknown as AnkiBridgePlugin;
	return { plugin, process, getContent: () => content };
}

beforeEach(() => {
	provider.processText.mockReset();
});

describe('planGenerate', () => {
	it('returns the word, provider and target fields minus the input field', async () => {
		const { plugin } = setup({ ticked: ['Word', 'Meaning'] });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toEqual({
			provider,
			word: '薬',
			targetFields: ['Meaning'],
			context: { targetLanguage: undefined, nativeLanguage: undefined },
		});
	});

	it('resolves targetLanguage from the selected profile, and nativeLanguage from global settings', async () => {
		const { plugin } = setup({
			targetLanguage: 'Japanese',
			nativeLanguage: 'English',
		});
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({
			context: { targetLanguage: 'Japanese', nativeLanguage: 'English' },
		});
	});

	it("passes this Deck+Model's approved cards as examples", async () => {
		const { plugin } = setup();
		const examples = [{ word: '火', fields: { Meaning: 'fire' } }];
		plugin.settings.generateExamples = {
			[examplesKey('D', 'M', '')]: examples,
		};
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({ context: { examples } });
	});

	it("passes this Deck+Model's custom instruction", async () => {
		const { plugin } = setup();
		plugin.settings.textInstructions = {
			[fieldConfigKey('D', 'M')]: 'Be funny.',
			[fieldConfigKey('D', 'Other')]: 'Be serious.',
		};
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({ context: { instruction: 'Be funny.' } });
	});

	it('only passes examples written for the selected Learning language', async () => {
		const { plugin } = setup({ targetLanguage: 'Japanese' });
		plugin.settings.generateExamples = {
			[examplesKey('D', 'M', 'English')]: [
				{ word: 'note', fields: { Meaning: 'ghi chú' } },
			],
		};
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({ context: { examples: undefined } });
	});

	it("uses the selected profile's language, not the profile matching the note's Deck+Model", async () => {
		const { plugin } = setup();
		plugin.settings.profiles = [
			{
				id: 'jp',
				name: 'Japan',
				deck: 'D',
				model: 'M',
				folder: '',
				mainField: '',
				targetLanguage: 'Japanese',
			},
			{
				id: 'en',
				name: 'English',
				deck: 'Other',
				model: 'M',
				folder: '',
				mainField: '',
				targetLanguage: 'English',
			},
		];
		plugin.settings.activeProfileId = 'en';
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({ context: { targetLanguage: 'English' } });
	});

	it('leaves targetLanguage undefined when the selected profile has none', async () => {
		const { plugin } = setup({ nativeLanguage: 'English' });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({
			context: { targetLanguage: undefined, nativeLanguage: 'English' },
		});
	});

	it('stops with the configure message when nothing is ticked', async () => {
		const { plugin } = setup({ ticked: [] });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toContain('configure AI field generation');
	});

	it('stops when no text model is configured', async () => {
		const { plugin } = setup({ provider: null });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toBe('Set up a text model in settings first.');
	});

	it('stops with the configure-Main-Field message when it is unset', async () => {
		const { plugin } = setup({ mainField: null });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toBe(
			'Please choose a main field for this deck/model in the sidebar first.',
		);
	});

	it('stops when the input section is empty and names the field', async () => {
		const { plugin } = setup({ content: '## Word\n\n## Meaning\n\n' });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toBe('Please fill in the Word section first.');
	});

	it('finds the input section through an alias (Front → ## Word)', async () => {
		const { plugin } = setup({ ticked: ['Back'], mainField: 'Front' });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({ word: '薬', targetFields: ['Back'] });
	});

	it('stops when only the input field is ticked', async () => {
		const { plugin } = setup({ ticked: ['Word'] });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toContain('Add at least one field besides Word');
	});
});

describe('generateDraft', () => {
	const plan = {
		provider,
		word: '薬',
		targetFields: ['Meaning', 'Furigana'],
		context: { targetLanguage: 'Japanese', nativeLanguage: 'English' },
	};

	it('calls the model once and returns its raw result, without touching the note', async () => {
		provider.processText.mockResolvedValue({
			Meaning: 'medicine',
			Furigana: 'くすり',
		});
		const { process, getContent } = setup({
			content: '## Word\n薬\n\n## Meaning\n\n## Furigana\nmine\n',
		});
		const before = getContent();

		const results = await generateDraft(plan);

		expect(provider.processText).toHaveBeenCalledTimes(1);
		expect(provider.processText).toHaveBeenCalledWith(
			'薬',
			'extract-vocabulary',
			['Meaning', 'Furigana'],
			plan.context,
		);
		expect(results).toEqual({ Meaning: 'medicine', Furigana: 'くすり' });
		expect(process).not.toHaveBeenCalled();
		expect(getContent()).toBe(before);
	});

	it('propagates a provider failure', async () => {
		provider.processText.mockRejectedValue(
			new ProviderError('p', 'HTTP 500 from http://x'),
		);

		await expect(generateDraft(plan)).rejects.toBeInstanceOf(ProviderError);
	});
});

describe('applyGenerated', () => {
	it('fills only empty sections and reports counts, from a given results map', async () => {
		const { plugin, getContent } = setup({
			content: '## Word\n薬\n\n## Meaning\n\n## Furigana\nmine\n',
		});

		const outcome = await applyGenerated(plugin, note, {
			Meaning: 'medicine',
			Furigana: 'くすり',
		});

		expect(outcome).toEqual({ filled: ['Meaning'], skipped: ['Furigana'] });
		expect(getContent()).toBe(
			'## Word\n薬\n\n## Meaning\n\nmedicine\n\n## Furigana\nmine\n',
		);
	});

	it('writes edited text, not necessarily what a model returned — the caller owns the map', async () => {
		const { plugin, getContent } = setup({
			content: '## Word\n薬\n\n## Meaning\n\n',
		});

		await applyGenerated(plugin, note, { Meaning: 'edited by hand' });

		expect(getContent()).toBe(
			'## Word\n薬\n\n## Meaning\n\nedited by hand\n\n',
		);
	});
});
