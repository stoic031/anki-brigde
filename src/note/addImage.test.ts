import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFile } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_SETTINGS, fieldConfigKey, type ImageFieldConfig } from '../settings';
import { ProviderError } from '../types';
import { IMAGE_PROMPT_KEY } from '../providers/text/prompt';
import { planAddImage, runAddImage } from './addImage';

const { modelFieldNames, storeMediaFile } = vi.hoisted(() => ({
	modelFieldNames: vi.fn(),
	storeMediaFile: vi.fn(),
}));
vi.mock('../sync/ankiConnect', () => ({
	AnkiConnectClient: class {
		modelFieldNames = modelFieldNames;
		storeMediaFile = storeMediaFile;
	},
}));

const note = { path: 'a.md' } as TFile;
const textProvider = { id: 'text-p', isCloud: false, processText: vi.fn() };
const imageProvider = { id: 'image-p', isCloud: false, generateImage: vi.fn() };

function setup(
	opts: {
		content?: string;
		config?: ImageFieldConfig;
		textProvider?: unknown;
		imageProvider?: unknown;
	} = {},
) {
	let content =
		opts.content ?? '## Word\n薬\n\n## Meaning\nmedicine\n\n## Image\n\n';
	const process = vi.fn(async (_f: TFile, fn: (c: string) => string) => {
		content = fn(content);
	});
	const plugin = {
		settings: {
			...structuredClone(DEFAULT_SETTINGS),
			imageConfigs: {
				[fieldConfigKey('D', 'M')]: opts.config ?? {
					outputField: 'Image',
					onExisting: 'append',
				},
			},
		},
		providers: {
			getTextProvider: () =>
				opts.textProvider === undefined ? textProvider : opts.textProvider,
			getImageProvider: () =>
				opts.imageProvider === undefined
					? imageProvider
					: opts.imageProvider,
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
	modelFieldNames.mockReset().mockResolvedValue(['Word', 'Meaning', 'Image']);
	storeMediaFile.mockReset().mockResolvedValue('_obsidian_test_image_1.png');
	textProvider.processText.mockReset();
	imageProvider.generateImage.mockReset();
});

describe('planAddImage', () => {
	it('gathers non-empty fields except Output, and the word for the filename', async () => {
		const { plugin } = setup();
		const plan = await planAddImage(plugin, note, 'D', 'M');

		expect(plan).toEqual({
			textProvider,
			imageProvider,
			fieldsInput: 'Word: 薬\nMeaning: medicine',
			word: '薬',
			outputField: 'Image',
			onExisting: 'append',
		});
	});

	it('stops with the configure message when no Output field is chosen', async () => {
		const { plugin } = setup({
			config: { outputField: '', onExisting: 'append' },
		});
		const plan = await planAddImage(plugin, note, 'D', 'M');

		expect(plan.stop).toContain('configure Image field mapping');
	});

	it('stops when no text model is configured, before touching Anki', async () => {
		const { plugin } = setup({ textProvider: null });
		const plan = await planAddImage(plugin, note, 'D', 'M');

		expect(plan.stop).toBe(
			'Set up a text model in settings to generate image prompts.',
		);
		expect(modelFieldNames).not.toHaveBeenCalled();
	});

	it('stops when no image model is configured', async () => {
		const { plugin } = setup({ imageProvider: null });
		const plan = await planAddImage(plugin, note, 'D', 'M');

		expect(plan.stop).toBe('Set up an image model in settings first.');
	});

	it('excludes the Output field even when it already has content', async () => {
		const { plugin } = setup({
			content:
				'## Word\n薬\n\n## Meaning\nmedicine\n\n## Image\n<img src="old.png">\n',
		});
		const plan = await planAddImage(plugin, note, 'D', 'M');

		expect(plan).toMatchObject({ fieldsInput: 'Word: 薬\nMeaning: medicine' });
	});

	it('stops when no field besides Output has content', async () => {
		const { plugin } = setup({
			content: '## Word\n\n## Meaning\n\n## Image\n\n',
		});
		const plan = await planAddImage(plugin, note, 'D', 'M');

		expect(plan.stop).toBe(
			'Nothing to generate an image from — please fill in at least one field first.',
		);
	});

	it('propagates AnkiConnect failures', async () => {
		modelFieldNames.mockRejectedValue(new Error('offline'));
		const { plugin } = setup();

		await expect(planAddImage(plugin, note, 'D', 'M')).rejects.toThrow(
			'offline',
		);
	});
});

describe('runAddImage', () => {
	const plan = {
		textProvider,
		imageProvider,
		fieldsInput: 'Word: 薬\nMeaning: medicine',
		word: '薬',
		outputField: 'Image',
		onExisting: 'append' as const,
	};

	it('builds the prompt, generates the image, stores it, and tags the Output section', async () => {
		textProvider.processText.mockResolvedValue({
			[IMAGE_PROMPT_KEY]: 'a drawing of medicine',
		});
		imageProvider.generateImage.mockResolvedValue({
			base64: 'YWJj',
			ext: 'png',
			mimeType: 'image/png',
		});
		const onPromptBuilt = vi.fn();
		const { plugin, getContent } = setup();

		const outcome = await runAddImage(plugin, note, plan, onPromptBuilt);

		expect(textProvider.processText).toHaveBeenCalledWith(
			'Word: 薬\nMeaning: medicine',
			'build-image-prompt',
			[],
		);
		expect(imageProvider.generateImage).toHaveBeenCalledWith(
			'a drawing of medicine',
			{},
		);
		expect(onPromptBuilt).toHaveBeenCalledTimes(1);
		expect(storeMediaFile).toHaveBeenCalledWith(
			expect.stringMatching(/^_obsidian_薬_image_\d+\.png$/),
			'YWJj',
		);
		expect(outcome).toEqual({ filename: '_obsidian_test_image_1.png' });
		expect(getContent()).toBe(
			'## Word\n薬\n\n## Meaning\nmedicine\n\n## Image\n\n<img src="_obsidian_test_image_1.png">',
		);
	});

	it('works without an onPromptBuilt callback', async () => {
		textProvider.processText.mockResolvedValue({ [IMAGE_PROMPT_KEY]: 'x' });
		imageProvider.generateImage.mockResolvedValue({
			base64: 'YWJj',
			ext: 'png',
			mimeType: 'image/png',
		});
		const { plugin } = setup();

		await expect(runAddImage(plugin, note, plan)).resolves.toEqual({
			filename: '_obsidian_test_image_1.png',
		});
	});

	it('throws when the text model returns no prompt, without calling the image model', async () => {
		textProvider.processText.mockResolvedValue({});
		const { plugin } = setup();

		await expect(runAddImage(plugin, note, plan)).rejects.toBeInstanceOf(
			ProviderError,
		);
		expect(imageProvider.generateImage).not.toHaveBeenCalled();
		expect(storeMediaFile).not.toHaveBeenCalled();
	});

	it('leaves the note untouched when the image provider fails', async () => {
		textProvider.processText.mockResolvedValue({ [IMAGE_PROMPT_KEY]: 'x' });
		imageProvider.generateImage.mockRejectedValue(
			new ProviderError('image-p', 'HTTP 500 from http://x'),
		);
		const { plugin, process } = setup();

		await expect(runAddImage(plugin, note, plan)).rejects.toBeInstanceOf(
			ProviderError,
		);
		expect(process).not.toHaveBeenCalled();
	});

	it('leaves the note untouched when storing the media file fails', async () => {
		textProvider.processText.mockResolvedValue({ [IMAGE_PROMPT_KEY]: 'x' });
		imageProvider.generateImage.mockResolvedValue({
			base64: 'YWJj',
			ext: 'png',
			mimeType: 'image/png',
		});
		storeMediaFile.mockRejectedValue(new Error('offline'));
		const { plugin, process } = setup();

		await expect(runAddImage(plugin, note, plan)).rejects.toThrow('offline');
		expect(process).not.toHaveBeenCalled();
	});
});
