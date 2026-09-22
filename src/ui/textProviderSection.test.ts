import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_SETTINGS,
	type AnkiBridgeSettings,
	type TextProviderConfig,
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
	addButton(cb: (b: FakeButton) => void) {
		const b = new FakeButton();
		this.buttons.push(b);
		cb(b);
		return this;
	}
}

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

import { ProviderError } from '../types';
import { clearModelCache } from './providerEditor';
import { renderTextProviderSection } from './textProviderSection';

const flush = () => new Promise((r) => setTimeout(r, 0));

// Each render recreates the Settings, so always read the most recent one by name.
const latest = (name: string) =>
	[...(rendered as FakeSetting[])].reverse().find((s) => s.name === name);

function setup(overrides: Partial<AnkiBridgeSettings> = {}) {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const settings: AnkiBridgeSettings = {
		...structuredClone(DEFAULT_SETTINGS),
		...overrides,
	};
	const root = new FakeEl();
	renderTextProviderSection(
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

// A local provider (editable Base URL, no API key) and a cloud one (fixed URL, API key).
const local: TextProviderConfig = {
	id: 'p1',
	name: 'Local',
	type: 'ollama',
	baseUrl: 'http://localhost:11434',
	apiKeySource: 'manual',
	apiKey: '',
	apiKeySecretId: '',
	model: 'llama3.1',
};
const cloud: TextProviderConfig = {
	...local,
	id: 'p2',
	name: 'OpenAI',
	type: 'openai',
	baseUrl: '',
	model: 'gpt-4o',
};

const models = (...ids: string[]) => ({ models: ids, fellBack: false });

beforeEach(() => {
	Notice.mockClear();
	rendered.length = 0;
	secrets.length = 0;
	clearModelCache();
	listModels.mockReset().mockResolvedValue(models());
	vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
});

describe('renderTextProviderSection', () => {
	it('shows only the active dropdown when nothing is configured', () => {
		setup();
		const active = latest('Active provider');
		expect(active?.dropdowns[0]?.options).toEqual({ '': 'None' });
		expect(active?.buttons[1]?.disabled).toBe(true);
		expect(latest('Provider')).toBeUndefined();
	});

	it('Add creates an OpenAI config (fixed URL, no Base URL row), activates it and saves', async () => {
		const { settings, saveSettings } = setup();
		await latest('Active provider')?.buttons[0]?.clickCb();

		expect(settings.textProviders[0]).toMatchObject({
			id: 'new-id',
			name: 'New provider',
			type: 'openai',
			baseUrl: '',
			model: '',
		});
		expect(settings.activeTextProviderId).toBe('new-id');
		expect(saveSettings).toHaveBeenCalled();
		expect(latest('Provider')).toBeDefined();
		expect(latest('Base URL')).toBeUndefined();
	});

	it('Delete removes the active config and clears the active id', async () => {
		const { settings } = setup({
			textProviders: [local],
			activeTextProviderId: 'p1',
		});
		await latest('Active provider')?.buttons[1]?.clickCb();

		expect(settings.textProviders).toEqual([]);
		expect(settings.activeTextProviderId).toBe('');
	});

	it('choosing None keeps the config but deactivates it', async () => {
		const { settings } = setup({
			textProviders: [local],
			activeTextProviderId: 'p1',
		});
		await latest('Active provider')?.dropdowns[0]?.changeCb('');

		expect(settings.textProviders).toHaveLength(1);
		expect(settings.activeTextProviderId).toBe('');
	});

	it('lists exactly the fixed text providers, labelled cloud or local', () => {
		setup({ textProviders: [local], activeTextProviderId: 'p1' });

		expect(latest('Provider')?.dropdowns[0]?.options).toEqual({
			openai: 'OpenAI (cloud)',
			gemini: 'Gemini (cloud)',
			anthropic: 'Anthropic (cloud)',
			groq: 'Groq (cloud)',
			openrouter: 'OpenRouter (cloud)',
			together: 'Together (cloud)',
			ollama: 'Ollama (local)',
		});
	});

	it('shows the Base URL only for local providers, and no API key rows for them', () => {
		setup({ textProviders: [local], activeTextProviderId: 'p1' });
		expect(latest('Base URL')).toBeDefined();
		expect(latest('API key source')).toBeUndefined();
		expect(latest('API key')).toBeUndefined();

		rendered.length = 0;
		setup({ textProviders: [cloud], activeTextProviderId: 'p2' });
		expect(latest('Base URL')).toBeUndefined();
		expect(latest('API key source')).toBeDefined();
	});

	it('switching to a cloud provider clears the URL and model; back to Ollama restores its default', async () => {
		const { settings } = setup({
			textProviders: [{ ...local }],
			activeTextProviderId: 'p1',
		});

		await latest('Provider')?.dropdowns[0]?.changeCb('anthropic');
		expect(settings.textProviders[0]).toMatchObject({
			type: 'anthropic',
			baseUrl: '',
			model: '',
		});

		await latest('Provider')?.dropdowns[0]?.changeCb('ollama');
		expect(settings.textProviders[0]).toMatchObject({
			type: 'ollama',
			baseUrl: 'http://localhost:11434',
		});
	});

	it('rejects an invalid Base URL with a notice and does not save it', async () => {
		const { settings, saveSettings } = setup({
			textProviders: [{ ...local }],
			activeTextProviderId: 'p1',
		});
		saveSettings.mockClear();
		const field = latest('Base URL')?.texts[0];
		await field?.commit('not a url');

		expect(Notice).toHaveBeenCalledWith(
			'❌ Invalid URL. Please check the base URL.',
		);
		expect(settings.textProviders[0]?.baseUrl).toBe(local.baseUrl);
		expect(field?.value).toBe(local.baseUrl);
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it('saves a valid Base URL trimmed and refetches models', async () => {
		const { settings } = setup({
			textProviders: [{ ...local }],
			activeTextProviderId: 'p1',
		});
		await latest('Base URL')?.texts[0]?.commit(
			'  http://192.168.1.5:11434 ',
		);

		expect(settings.textProviders[0]?.baseUrl).toBe(
			'http://192.168.1.5:11434',
		);
		expect(listModels).toHaveBeenCalledWith(
			'text',
			'ollama',
			'http://192.168.1.5:11434',
			'',
		);
	});

	it('rejects an empty name', async () => {
		const { settings } = setup({
			textProviders: [{ ...local }],
			activeTextProviderId: 'p1',
		});
		await latest('Name')?.texts[0]?.commit('   ');

		expect(Notice).toHaveBeenCalledWith('❌ Name cannot be empty.');
		expect(settings.textProviders[0]?.name).toBe('Local');
	});

	it('stores the API key and model as typed, masks the key field', async () => {
		const { settings } = setup({
			textProviders: [{ ...cloud }],
			activeTextProviderId: 'p2',
		});
		const key = latest('API key')?.texts[0];
		expect(key?.inputEl.type).toBe('password');
		await key?.changeCb(' test-key ');
		await latest('Model')?.texts[0]?.changeCb('gpt-4o-mini');

		expect(settings.textProviders[0]).toMatchObject({
			apiKey: 'test-key',
			model: 'gpt-4o-mini',
		});
	});

	it('labels local providers as Local and cloud ones as Cloud, naming the provider', () => {
		const a = setup({
			textProviders: [{ ...local }],
			activeTextProviderId: 'p1',
		});
		expect(a.root.all().some((e) => e.text.startsWith('Local:'))).toBe(
			true,
		);

		const b = setup({
			textProviders: [{ ...cloud }],
			activeTextProviderId: 'p2',
		});
		expect(
			b.root
				.all()
				.some(
					(e) =>
						e.text ===
						'Cloud: your note text and API key are sent to OpenAI.',
				),
		).toBe(true);
	});

	describe('API key source', () => {
		it('offers manual and keychain, and switching to keychain shows the secret picker', async () => {
			const { settings } = setup({
				textProviders: [{ ...cloud }],
				activeTextProviderId: 'p2',
			});
			expect(latest('API key')?.texts).toHaveLength(1);

			const source = latest('API key source')?.dropdowns[0];
			expect(source?.options).toEqual({
				manual: 'Enter manually',
				keychain: 'Obsidian keychain',
			});
			await source?.changeCb('keychain');

			expect(settings.textProviders[0]?.apiKeySource).toBe('keychain');
			expect(latest('API key')?.texts).toHaveLength(0);
			expect(latest('API key')?.components).toHaveLength(1);
		});

		it('stores only the secret name, never the key value', async () => {
			const { settings } = setup({
				textProviders: [{ ...cloud, apiKeySource: 'keychain' }],
				activeTextProviderId: 'p2',
			});
			const secret = secrets[secrets.length - 1] as FakeSecret;
			await secret.changeCb('my-key');

			expect(settings.textProviders[0]?.apiKeySecretId).toBe('my-key');
			expect(JSON.stringify(settings)).not.toContain('test-secret');
			// The lookup used for the model listing resolves the secret from the keychain.
			expect(listModels).toHaveBeenLastCalledWith(
				'text',
				'openai',
				'https://api.openai.com/v1',
				'test-secret',
			);
		});
	});

	describe('model list', () => {
		it('does not touch the network just by rendering', () => {
			setup({
				textProviders: [{ ...cloud }],
				activeTextProviderId: 'p2',
			});

			expect(listModels).not.toHaveBeenCalled();
			expect(latest('Model')?.texts).toHaveLength(1); // free text until models are known
		});

		it('Refresh fetches from the provider’s fixed endpoint and shows a select of the models', async () => {
			listModels.mockResolvedValue(models('gpt-4o', 'gpt-4o-mini'));
			const { settings } = setup({
				textProviders: [{ ...cloud, model: '' }],
				activeTextProviderId: 'p2',
			});
			await latest('Model')?.buttons[0]?.clickCb();

			expect(listModels).toHaveBeenCalledWith(
				'text',
				'openai',
				'https://api.openai.com/v1',
				'',
			);
			const model = latest('Model');
			expect(model?.texts).toHaveLength(0);
			expect(model?.dropdowns[0]?.options).toEqual({
				'': 'Select a model…',
				'gpt-4o': 'gpt-4o',
				'gpt-4o-mini': 'gpt-4o-mini',
			});

			await model?.dropdowns[0]?.changeCb('gpt-4o-mini');
			expect(settings.textProviders[0]?.model).toBe('gpt-4o-mini');
		});

		it('says how many of the provider’s models the filter kept', async () => {
			listModels.mockResolvedValue({
				models: ['a', 'b'],
				total: 5,
				fellBack: false,
			});
			setup({
				textProviders: [{ ...cloud }],
				activeTextProviderId: 'p2',
			});
			await latest('Model')?.buttons[0]?.clickCb();
			expect(latest('Model')?.desc).toBe(
				'2 text models available (of 5 the provider reports).',
			);

			rendered.length = 0;
			clearModelCache();
			listModels.mockResolvedValue({
				models: ['a', 'b'],
				total: 2,
				fellBack: false,
			});
			setup({
				textProviders: [{ ...cloud, id: 'p9' }],
				activeTextProviderId: 'p9',
			});
			await latest('Model')?.buttons[0]?.clickCb();
			expect(latest('Model')?.desc).toBe('2 text models available.');
		});

		it('keeps a saved model the provider does not list', async () => {
			listModels.mockResolvedValue(models('a'));
			setup({
				textProviders: [{ ...cloud, model: 'old-model' }],
				activeTextProviderId: 'p2',
			});
			await latest('Model')?.buttons[0]?.clickCb();

			expect(latest('Model')?.dropdowns[0]?.options).toHaveProperty(
				'old-model',
			);
		});

		it('says so when the filter matched nothing and every model is shown', async () => {
			listModels.mockResolvedValue({
				models: ['x', 'y'],
				fellBack: true,
			});
			setup({
				textProviders: [{ ...cloud }],
				activeTextProviderId: 'p2',
			});
			await latest('Model')?.buttons[0]?.clickCb();

			expect(latest('Model')?.desc).toBe(
				'No text models recognised, so all 2 models from this provider are shown.',
			);
		});

		it('falls back to a text field with a hint when listing fails', async () => {
			listModels.mockRejectedValue(
				new ProviderError(
					'openai',
					'HTTP 401 from https://api.openai.com/v1/models',
				),
			);
			setup({
				textProviders: [{ ...cloud }],
				activeTextProviderId: 'p2',
			});
			await latest('Model')?.buttons[0]?.clickCb();

			const model = latest('Model');
			expect(model?.texts).toHaveLength(1);
			expect(model?.desc).toBe(
				"Couldn't load models: openai: HTTP 401 from https://api.openai.com/v1/models. Type the model name instead.",
			);
		});

		it('Refresh refetches, and is disabled for a local provider with no Base URL', async () => {
			listModels.mockResolvedValue(models('a'));
			setup({
				textProviders: [{ ...cloud }],
				activeTextProviderId: 'p2',
			});
			await latest('Model')?.buttons[0]?.clickCb();
			await latest('Model')?.buttons[0]?.clickCb();
			expect(listModels).toHaveBeenCalledTimes(2);

			rendered.length = 0;
			setup({
				textProviders: [{ ...local, id: 'p3', baseUrl: '' }],
				activeTextProviderId: 'p3',
			});
			expect(latest('Model')?.buttons[0]?.disabled).toBe(true);
		});

		it('changing the provider refetches for the new one', async () => {
			listModels.mockResolvedValue(models('claude-x'));
			setup({
				textProviders: [{ ...cloud }],
				activeTextProviderId: 'p2',
			});
			await latest('Provider')?.dropdowns[0]?.changeCb('anthropic');

			expect(listModels).toHaveBeenCalledWith(
				'text',
				'anthropic',
				'https://api.anthropic.com',
				'',
			);
		});
	});
});
