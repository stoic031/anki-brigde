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

const { listImageModels } = vi.hoisted(() => ({ listImageModels: vi.fn() }));
vi.mock('../providers/image/listModels', () => ({
	listImageModels,
	AUTOMATIC1111_DEFAULT_URL: 'http://localhost:7860',
}));

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

const config: ImageProviderConfig = {
	id: 'i1',
	name: 'OpenAI',
	type: 'openai-compatible',
	baseUrl: 'https://api.openai.com/v1',
	apiKeySource: 'manual',
	apiKey: '',
	apiKeySecretId: '',
	model: 'gpt-image-1',
	negativePrompt: '',
};

beforeEach(() => {
	Notice.mockClear();
	rendered.length = 0;
	secrets.length = 0;
	clearModelCache();
	listImageModels.mockReset().mockResolvedValue([]);
	vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
});

describe('renderImageProviderSection', () => {
	it('starts with only the active dropdown and never touches the text list', () => {
		const { settings } = setup();

		expect(latest('Active provider')?.dropdowns[0]?.options).toEqual({
			'': 'None',
		});
		expect(latest('Base URL')).toBeUndefined();
		expect(settings.textProviders).toEqual([]);
	});

	it('Add creates an image config with an empty negative prompt and activates it', async () => {
		const { settings, saveSettings } = setup();
		await latest('Active provider')?.buttons[0]?.clickCb();

		expect(settings.imageProviders).toEqual([
			expect.objectContaining({
				id: 'new-id',
				type: 'openai-compatible',
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
			imageProviders: [{ ...config }],
			activeImageProviderId: 'i1',
		});
		await latest('Active provider')?.buttons[1]?.clickCb();

		expect(settings.imageProviders).toEqual([]);
		expect(settings.activeImageProviderId).toBe('');
	});

	it('does not fetch models just by rendering', () => {
		setup({ imageProviders: [{ ...config }], activeImageProviderId: 'i1' });

		expect(listImageModels).not.toHaveBeenCalled();
	});

	it('switching to Automatic1111 pre-fills the local URL, hides the API key and refetches', async () => {
		const { settings } = setup({
			imageProviders: [{ ...config, baseUrl: '', model: '' }],
			activeImageProviderId: 'i1',
		});
		expect(latest('API key source')).toBeDefined();

		await latest('Type')?.dropdowns[0]?.changeCb('automatic1111');

		expect(settings.imageProviders[0]?.baseUrl).toBe(
			'http://localhost:7860',
		);
		expect(latest('Base URL')?.texts[0]?.value).toBe(
			'http://localhost:7860',
		);
		expect(listImageModels).toHaveBeenLastCalledWith(
			expect.objectContaining({
				type: 'automatic1111',
				baseUrl: 'http://localhost:7860',
			}),
		);
	});

	it('shows no API key rows for Automatic1111, and clears the default URL when leaving it', async () => {
		const { settings } = setup({
			imageProviders: [
				{
					...config,
					type: 'automatic1111',
					baseUrl: 'http://localhost:7860',
					model: '',
				},
			],
			activeImageProviderId: 'i1',
		});
		expect(latest('API key source')).toBeUndefined();
		expect(latest('API key')).toBeUndefined();

		await latest('Type')?.dropdowns[0]?.changeCb('openai-compatible');

		expect(settings.imageProviders[0]?.baseUrl).toBe('');
		expect(latest('API key source')).toBeDefined();
	});

	it('saves the negative prompt on change, trimmed', () => {
		const { settings, saveSettings } = setup({
			imageProviders: [{ ...config }],
			activeImageProviderId: 'i1',
		});
		saveSettings.mockClear();
		const area = latest('Negative prompt')?.areas[0];
		area?.setValue('  blurry, text  ');
		area?.inputEl.handlers.change?.();

		expect(settings.imageProviders[0]?.negativePrompt).toBe('blurry, text');
		expect(saveSettings).toHaveBeenCalled();
	});

	it('shows a model dropdown after Refresh and saves the pick', async () => {
		listImageModels.mockResolvedValue(['dall-e-3', 'gpt-image-1']);
		const { settings } = setup({
			imageProviders: [{ ...config }],
			activeImageProviderId: 'i1',
		});
		await latest('Model')?.buttons[0]?.clickCb();

		const model = latest('Model');
		expect(model?.dropdowns[0]?.options).toHaveProperty('dall-e-3');
		await model?.dropdowns[0]?.changeCb('dall-e-3');
		expect(settings.imageProviders[0]?.model).toBe('dall-e-3');
	});

	it('labels localhost as Local and other hosts as Cloud with the image wording', () => {
		const local = setup({
			imageProviders: [
				{
					...config,
					type: 'automatic1111',
					baseUrl: 'http://localhost:7860',
				},
			],
			activeImageProviderId: 'i1',
		});
		expect(local.root.all().some((e) => e.text.startsWith('Local:'))).toBe(
			true,
		);

		const cloud = setup({
			imageProviders: [{ ...config }],
			activeImageProviderId: 'i1',
		});
		expect(
			cloud.root
				.all()
				.some(
					(e) =>
						e.text ===
						'Cloud: your prompts and API key are sent to this URL.',
				),
		).toBe(true);
	});
});
