import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFile } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_SETTINGS, fieldConfigKey } from '../settings';
import { ProviderError } from '../types';
import { applyGenerated, generateDraft, planGenerate } from './generateFields';

const { modelFieldNames } = vi.hoisted(() => ({ modelFieldNames: vi.fn() }));
vi.mock('../sync/ankiConnect', () => ({
	AnkiConnectClient: class {
		modelFieldNames = modelFieldNames;
	},
}));

const note = { path: 'a.md' } as TFile;
const provider = { id: 'p', isCloud: false, processText: vi.fn() };

function setup(
	opts: { content?: string; ticked?: string[]; provider?: unknown } = {},
) {
	let content =
		opts.content ?? '## Word\n薬\n\n## Meaning\n\n## Furigana\n\n';
	const process = vi.fn(async (_f: TFile, fn: (c: string) => string) => {
		content = fn(content);
	});
	const plugin = {
		settings: {
			...structuredClone(DEFAULT_SETTINGS),
			generateWithAiFields: {
				[fieldConfigKey('D', 'M')]: opts.ticked ?? [
					'Meaning',
					'Furigana',
				],
			},
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
	modelFieldNames
		.mockReset()
		.mockResolvedValue(['Word', 'Meaning', 'Furigana']);
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
		});
	});

	it('stops with the configure message when nothing is ticked', async () => {
		const { plugin } = setup({ ticked: [] });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toContain('configure AI field generation');
	});

	it('stops when no text model is configured, before touching Anki', async () => {
		const { plugin } = setup({ provider: null });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toBe('Set up a text model in settings first.');
		expect(modelFieldNames).not.toHaveBeenCalled();
	});

	it('stops when the input section is empty and names the field', async () => {
		const { plugin } = setup({ content: '## Word\n\n## Meaning\n\n' });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toBe('Please fill in the Word section first.');
	});

	it('finds the input section through an alias (Front → ## Word)', async () => {
		modelFieldNames.mockResolvedValue(['Front', 'Back']);
		const { plugin } = setup({ ticked: ['Back'] });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({ word: '薬', targetFields: ['Back'] });
	});

	it('stops when only the input field is ticked', async () => {
		const { plugin } = setup({ ticked: ['Word'] });
		const plan = await planGenerate(plugin, note, 'D', 'M');

		expect(plan.stop).toContain('Add at least one field besides Word');
	});

	it('propagates AnkiConnect failures', async () => {
		modelFieldNames.mockRejectedValue(new Error('offline'));
		const { plugin } = setup();

		await expect(planGenerate(plugin, note, 'D', 'M')).rejects.toThrow(
			'offline',
		);
	});
});

describe('generateDraft', () => {
	const plan = {
		provider,
		word: '薬',
		targetFields: ['Meaning', 'Furigana'],
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
