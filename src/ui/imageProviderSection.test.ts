import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_SETTINGS,
	type AnkiBridgeSettings,
	type ImageProviderConfig,
} from '../settings';

class FakeEl {
	children: FakeEl[] = [];
	text = '';
	cls = '';
	createDiv(opts?: { cls?: string; text?: string }): FakeEl {
		return this.createEl('div', opts);
	}
	createEl(_tag: string, opts?: { cls?: string; text?: string }): FakeEl {
		const el = new FakeEl();
		el.cls = opts?.cls ?? '';
		el.text = opts?.text ?? '';
		this.children.push(el);
		return el;
	}
	empty() {
		this.children = [];
	}
	all(): FakeEl[] {
		return this.children.flatMap((c) => [c, ...c.all()]);
	}
}

class FakeText {
	value = '';
	inputEl = {
		type: 'text',
		setAttribute: vi.fn(),
		handlers: {} as Record<string, () => void>,
		addEventListener(name: string, cb: () => void) {
			this.handlers[name] = cb;
		},
	};
	changeCb: (v: string) => unknown = () => {};
	setPlaceholder() {
		return this;
	}
	setValue(v: string) {
		this.value = v;
		return this;
	}
	getValue() {
		return this.value;
	}
	onChange(cb: (v: string) => unknown) {
		this.changeCb = cb;
		return this;
	}
	// Simulates the user typing then blurring: value first, then the DOM change event.
	async commit(v: string) {
		this.value = v;
		this.inputEl.handlers.change?.();
		await flush();
	}
}

class FakeDropdown {
	options: Record<string, string> = {};
	value = '';
	changeCb: (v: string) => unknown = () => {};
	addOption(v: string, label: string) {
		this.options[v] = label;
		return this;
	}
	setValue(v: string) {
		this.value = v;
		return this;
	}
	onChange(cb: (v: string) => unknown) {
		this.changeCb = cb;
		return this;
	}
}

class FakeButton {
	text = '';
	disabled = false;
	clickCb: () => unknown = () => {};
	setButtonText(t: string) {
		this.text = t;
		return this;
	}
	setWarning() {
		return this;
	}
	setDisabled(d: boolean) {
		this.disabled = d;
		return this;
	}
	onClick(cb: () => unknown) {
		this.clickCb = cb;
		return this;
	}
}

class FakeSecret {
	value = '';
	changeCb: (v: string) => unknown = () => {};
	setValue(v: string) {
		this.value = v;
		return this;
	}
	onChange(cb: (v: string) => unknown) {
		this.changeCb = cb;
		return this;
	}
}

class FakeArea {
	value = '';
	inputEl = {
		handlers: {} as Record<string, () => void>,
		addEventListener(name: string, cb: () => void) {
			this.handlers[name] = cb;
		},
	};
	setValue(v: string) {
		this.value = v;
		return this;
	}
	getValue() {
		return this.value;
	}
}

class FakeSetting {
	name = '';
	texts: FakeText[] = [];
	dropdowns: FakeDropdown[] = [];
	buttons: FakeButton[] = [];
	setName(n: string) {
		this.name = n;
		return this;
	}
	setHeading() {
		return this;
	}
	setDesc(d: string) {
		this.desc = d;
		return this;
	}
	addText(cb: (t: FakeText) => void) {
		const t = new FakeText();
		this.texts.push(t);
		cb(t);
		return this;
	}
	addDropdown(cb: (d: FakeDropdown) => void) {
		const d = new FakeDropdown();
		this.dropdowns.push(d);
		cb(d);
		return this;
	}
	components: FakeSecret[] = [];
	desc = '';
	addComponent(cb: (el: unknown) => FakeSecret) {
		this.components.push(cb({}));
		return this;
	}
	areas: FakeArea[] = [];
	addTextArea(cb: (a: FakeArea) => void) {
		const a = new FakeArea();
		this.areas.push(a);
		cb(a);
		return this;
	}
	addButton(cb: (b: FakeButton) => void) {
		const b = new FakeButton();
		this.buttons.push(b);
		cb(b);
		return this;
	}
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const { Notice, rendered, secrets } = vi.hoisted(() => ({
	Notice: vi.fn(),
	rendered: [] as unknown[],
	secrets: [] as unknown[],
}));
vi.mock('obsidian', () => ({
	Notice,
	SecretComponent: class {
		constructor() {
			const s = new FakeSecret();
			secrets.push(s);
			return s;
		}
	},
	Setting: class {
		constructor() {
			const s = new FakeSetting();
			rendered.push(s);
			return s;
		}
	},
}));

const { listModels } = vi.hoisted(() => ({ listModels: vi.fn() }));
vi.mock('../providers/modelLists', () => ({ listModels }));

const { listWorkflows, fetchWorkflow } = vi.hoisted(() => ({
	listWorkflows: vi.fn(),
	fetchWorkflow: vi.fn(),
}));
vi.mock('../providers/image/comfyWorkflow', async (importActual) => ({
	...(await importActual<
		typeof import('../providers/image/comfyWorkflow')
	>()),
	listWorkflows,
	fetchWorkflow,
}));

import { ProviderError } from '../types';
import { clearWorkflowCache } from './comfyWorkflowRow';
import { clearModelCache } from './providerEditor';
import { renderImageProviderSection } from './imageProviderSection';
const latest = (name: string) =>
	[...(rendered as FakeSetting[])].reverse().find((s) => s.name === name);

function setup(overrides: Partial<AnkiBridgeSettings> = {}) {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const settings: AnkiBridgeSettings = {
		...structuredClone(DEFAULT_SETTINGS),
		...overrides,
	};
	const root = new FakeEl();
	renderImageProviderSection(
		root as unknown as HTMLElement,
		{
			settings,
			saveSettings,
			app: {
				secretStorage: {
					getSecret: (id: string) =>
						id === 'my-key' ? 'test-secret' : null,
				},
			},
		} as never,
	);
	return { settings, saveSettings, root };
}

const auto: ImageProviderConfig = {
	id: 'i1',
	name: 'Local SD',
	type: 'automatic1111',
	baseUrl: 'http://localhost:7860',
	apiKeySource: 'manual',
	apiKey: '',
	apiKeySecretId: '',
	model: '',
	negativePrompt: '',
	workflow: '',
};
const openai: ImageProviderConfig = {
	...auto,
	id: 'i2',
	name: 'OpenAI',
	type: 'openai',
	baseUrl: '',
	model: 'dall-e-3',
};
const models = (...ids: string[]) => ({ models: ids, fellBack: false });

beforeEach(() => {
	Notice.mockClear();
	rendered.length = 0;
	secrets.length = 0;
	clearModelCache();
	clearWorkflowCache();
	listWorkflows.mockReset().mockResolvedValue([]);
	fetchWorkflow.mockReset();
	listModels.mockReset().mockResolvedValue(models());
	vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
});

describe('renderImageProviderSection', () => {
	it('starts with only the active dropdown and never touches the text list', () => {
		const { settings } = setup();

		expect(latest('Active provider')?.dropdowns[0]?.options).toEqual({
			'': 'None',
		});
		expect(latest('Provider')).toBeUndefined();
		expect(settings.textProviders).toEqual([]);
	});

	it('lists exactly the fixed image providers, labelled cloud or local', () => {
		setup({ imageProviders: [{ ...auto }], activeImageProviderId: 'i1' });

		expect(latest('Provider')?.dropdowns[0]?.options).toEqual({
			pollinations: 'Pollinations (cloud)',
			gemini: 'Gemini (cloud)',
			openai: 'OpenAI (cloud)',
			openrouter: 'OpenRouter (cloud)',
			automatic1111: 'Automatic1111 (local)',
			comfyui: 'ComfyUI (local)',
		});
	});

	it('Add creates a Pollinations config with an empty negative prompt and activates it', async () => {
		const { settings, saveSettings } = setup();
		await latest('Active provider')?.buttons[0]?.clickCb();

		expect(settings.imageProviders).toEqual([
			expect.objectContaining({
				id: 'new-id',
				type: 'pollinations',
				baseUrl: '',
				negativePrompt: '',
				apiKeySource: 'manual',
			}),
		]);
		expect(settings.activeImageProviderId).toBe('new-id');
		expect(settings.textProviders).toEqual([]);
		expect(saveSettings).toHaveBeenCalled();
	});

	it('Delete removes the active config and clears the active id', async () => {
		const { settings } = setup({
			imageProviders: [{ ...auto }],
			activeImageProviderId: 'i1',
		});
		await latest('Active provider')?.buttons[1]?.clickCb();

		expect(settings.imageProviders).toEqual([]);
		expect(settings.activeImageProviderId).toBe('');
	});

	it('does not fetch models just by rendering', () => {
		setup({ imageProviders: [{ ...openai }], activeImageProviderId: 'i2' });

		expect(listModels).not.toHaveBeenCalled();
	});

	it('local providers show a Base URL and no API key; cloud ones the reverse', () => {
		setup({ imageProviders: [{ ...auto }], activeImageProviderId: 'i1' });
		expect(latest('Base URL')).toBeDefined();
		expect(latest('API key source')).toBeUndefined();

		rendered.length = 0;
		setup({ imageProviders: [{ ...openai }], activeImageProviderId: 'i2' });
		expect(latest('Base URL')).toBeUndefined();
		expect(latest('API key source')).toBeDefined();
	});

	it('Pollinations has an optional API key and an optional model', () => {
		setup({
			imageProviders: [{ ...openai, type: 'pollinations', model: '' }],
			activeImageProviderId: 'i2',
		});

		expect(latest('API key')?.desc).toContain('Optional.');
		expect(latest('Model')?.desc).toContain('Optional');
	});

	it('switching to ComfyUI pre-fills its address, clears the model, and lists workflows instead of models', async () => {
		const { settings } = setup({
			imageProviders: [{ ...openai }],
			activeImageProviderId: 'i2',
		});
		listWorkflows.mockResolvedValue(['icons.json']);

		const provider = latest('Provider')?.dropdowns[0];
		rendered.length = 0; // only look at what the change re-renders
		await provider?.changeCb('comfyui');

		expect(settings.imageProviders[0]).toMatchObject({
			type: 'comfyui',
			baseUrl: 'http://localhost:8188',
			model: '',
			workflow: '',
		});
		expect(listWorkflows).toHaveBeenCalledWith('http://localhost:8188');
		expect(listModels).not.toHaveBeenCalled();
		expect(latest('API key source')).toBeUndefined();
		expect(latest('Model')).toBeUndefined();
		expect(latest('Workflow')?.dropdowns[0]?.options).toHaveProperty(
			'icons.json',
		);
	});

	it('saves the negative prompt on change, trimmed', () => {
		const { settings, saveSettings } = setup({
			imageProviders: [{ ...auto }],
			activeImageProviderId: 'i1',
		});
		saveSettings.mockClear();
		const area = latest('Negative prompt')?.areas[0];
		area?.setValue('  blurry, text  ');
		area?.inputEl.handlers.change?.();

		expect(settings.imageProviders[0]?.negativePrompt).toBe('blurry, text');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('shows only image models after Refresh and saves the pick', async () => {
		listModels.mockResolvedValue(models('dall-e-3', 'gpt-image-1'));
		const { settings } = setup({
			imageProviders: [{ ...openai }],
			activeImageProviderId: 'i2',
		});
		await latest('Model')?.buttons[0]?.clickCb();

		expect(listModels).toHaveBeenCalledWith(
			'image',
			'openai',
			'https://api.openai.com/v1',
			'',
		);
		const model = latest('Model');
		expect(model?.dropdowns[0]?.options).toHaveProperty('gpt-image-1');
		expect(model?.desc).toBe('2 image models available.');
		await model?.dropdowns[0]?.changeCb('gpt-image-1');
		expect(settings.imageProviders[0]?.model).toBe('gpt-image-1');
	});

	it('labels local and cloud providers with the image wording', () => {
		const a = setup({
			imageProviders: [{ ...auto }],
			activeImageProviderId: 'i1',
		});
		expect(a.root.all().some((e) => e.text.startsWith('Local:'))).toBe(
			true,
		);

		const b = setup({
			imageProviders: [{ ...openai }],
			activeImageProviderId: 'i2',
		});
		expect(
			b.root
				.all()
				.some(
					(e) =>
						e.text ===
						'Cloud: your prompts and API key are sent to OpenAI.',
				),
		).toBe(true);
	});

	describe('ComfyUI workflow', () => {
		const comfy: ImageProviderConfig = {
			...auto,
			id: 'i3',
			name: 'ComfyUI',
			type: 'comfyui',
			baseUrl: 'http://localhost:8188',
		};
		const graph = {
			nodes: [
				{
					id: 7,
					type: 'KSampler',
					inputs: [
						{ name: 'positive', link: 4 },
						{ name: 'negative', link: 5 },
					],
				},
				{ id: 4, type: 'CLIPTextEncode', inputs: [] },
				{ id: 5, type: 'CLIPTextEncode', inputs: [] },
				{
					id: 12,
					type: 'CheckpointLoaderSimple',
					inputs: [],
					widgets_values: ['cartoonxl_v10.safetensors'],
				},
				{ id: 9, type: 'SaveImage', inputs: [] },
			],
			links: [
				[4, 4, 0, 7, 1, 'CONDITIONING'],
				[5, 5, 0, 7, 2, 'CONDITIONING'],
			],
		};

		it('shows a Workflow row instead of Model and API key, and does not fetch on render', () => {
			setup({
				imageProviders: [{ ...comfy }],
				activeImageProviderId: 'i3',
			});

			expect(latest('Workflow')?.desc).toBe(
				'Refresh to list the workflows saved in ComfyUI.',
			);
			expect(latest('Model')).toBeUndefined();
			expect(latest('API key')).toBeUndefined();
			expect(latest('Base URL')).toBeDefined();
			expect(listWorkflows).not.toHaveBeenCalled();
			expect(fetchWorkflow).not.toHaveBeenCalled();
		});

		it('Refresh lists the saved workflows; picking one saves it and shows what was found in it', async () => {
			listWorkflows.mockResolvedValue([
				'Unsaved Workflow.json',
				'icons.json',
			]);
			fetchWorkflow.mockResolvedValue(graph);
			const { settings } = setup({
				imageProviders: [{ ...comfy }],
				activeImageProviderId: 'i3',
			});
			await latest('Workflow')?.buttons[0]?.clickCb();

			const row = latest('Workflow');
			expect(row?.dropdowns[0]?.options).toEqual({
				'': 'Select a workflow…',
				'Unsaved Workflow.json': 'Unsaved Workflow.json',
				'icons.json': 'icons.json',
			});
			expect(row?.desc).toBe('2 saved workflows. Pick the one to run.');

			await row?.dropdowns[0]?.changeCb('icons.json');

			expect(settings.imageProviders[0]?.workflow).toBe('icons.json');
			expect(fetchWorkflow).toHaveBeenCalledWith(
				'http://localhost:8188',
				'icons.json',
			);
			expect(latest('Workflow')?.desc).toBe(
				'Positive prompt: node 4 (CLIPTextEncode) · Negative: node 5 · Checkpoint: cartoonxl_v10.safetensors',
			);
		});

		it('warns when the chosen workflow has no prompt node to inject into', async () => {
			listWorkflows.mockResolvedValue(['bare.json']);
			fetchWorkflow.mockResolvedValue({ nodes: [], links: [] });
			setup({
				imageProviders: [{ ...comfy }],
				activeImageProviderId: 'i3',
			});
			await latest('Workflow')?.buttons[0]?.clickCb();
			await latest('Workflow')?.dropdowns[0]?.changeCb('bare.json');

			expect(latest('Workflow')?.desc).toBe(
				"⚠ no KSampler found; no SaveImage node; image prompts can't be injected.",
			);
		});

		it('says so when ComfyUI has no saved workflows', async () => {
			setup({
				imageProviders: [{ ...comfy }],
				activeImageProviderId: 'i3',
			});
			await latest('Workflow')?.buttons[0]?.clickCb();

			expect(latest('Workflow')?.desc).toBe(
				'No saved workflows found. Save one in ComfyUI first.',
			);
		});

		it('falls back to a text field with a hint when the list fails', async () => {
			listWorkflows.mockRejectedValue(
				new ProviderError(
					'comfyui',
					'could not reach the endpoint (http://localhost:8188/api/userdata)',
				),
			);
			setup({
				imageProviders: [{ ...comfy }],
				activeImageProviderId: 'i3',
			});
			await latest('Workflow')?.buttons[0]?.clickCb();

			const row = latest('Workflow');
			expect(row?.texts).toHaveLength(1);
			expect(row?.desc).toBe(
				"Couldn't load workflows: comfyui: could not reach the endpoint (http://localhost:8188/api/userdata). Type the workflow path instead.",
			);
		});

		it('reports a workflow that cannot be read', async () => {
			listWorkflows.mockResolvedValue(['broken.json']);
			fetchWorkflow.mockRejectedValue(
				new ProviderError(
					'comfyui',
					'HTTP 404 from http://localhost:8188/x',
				),
			);
			setup({
				imageProviders: [{ ...comfy }],
				activeImageProviderId: 'i3',
			});
			await latest('Workflow')?.buttons[0]?.clickCb();
			await latest('Workflow')?.dropdowns[0]?.changeCb('broken.json');

			expect(latest('Workflow')?.desc).toBe(
				"Couldn't read this workflow: comfyui: HTTP 404 from http://localhost:8188/x.",
			);
		});

		it('keeps a saved workflow that the server no longer lists', async () => {
			listWorkflows.mockResolvedValue(['other.json']);
			fetchWorkflow.mockResolvedValue(graph);
			setup({
				imageProviders: [{ ...comfy, workflow: 'gone.json' }],
				activeImageProviderId: 'i3',
			});
			await latest('Workflow')?.buttons[0]?.clickCb();

			expect(latest('Workflow')?.dropdowns[0]?.options).toHaveProperty(
				'gone.json',
			);
		});

		it('Refresh is disabled while there is no Base URL', () => {
			setup({
				imageProviders: [{ ...comfy, baseUrl: '' }],
				activeImageProviderId: 'i3',
			});

			expect(latest('Workflow')?.buttons[0]?.disabled).toBe(true);
		});
	});
});
