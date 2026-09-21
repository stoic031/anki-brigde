import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type AnkiBridgeSettings, type TextProviderConfig } from '../settings';

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
vi.mock('../providers/text/listModels', () => ({ listModels }));

import { ProviderError } from '../types';
import { clearModelCache } from './textProviderEditor';
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
			app: { secretStorage: { getSecret: (id: string) => (id === 'my-key' ? 'test-secret' : null) } },
		} as never,
	);
	return { settings, saveSettings, root };
}

const config: TextProviderConfig = {
	id: 'p1',
	name: 'Local',
	type: 'openai-compatible' as const,
	baseUrl: 'http://localhost:11434/v1',
	apiKeySource: 'manual' as const,
	apiKey: '',
	apiKeySecretId: '',
	model: 'llama3.1',
};

beforeEach(() => {
	Notice.mockClear();
	rendered.length = 0;
	secrets.length = 0;
	clearModelCache();
	listModels.mockReset().mockResolvedValue([]);
	vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
});

describe('renderTextProviderSection', () => {
	it('shows only the active dropdown when nothing is configured', () => {
		setup();
		const active = latest('Active provider');
		expect(active?.dropdowns[0]?.options).toEqual({ '': 'None' });
		expect(active?.buttons[1]?.disabled).toBe(true);
		expect(latest('Base URL')).toBeUndefined();
	});

	it('Add creates an incomplete config, activates it and saves', async () => {
		const { settings, saveSettings } = setup();
		await latest('Active provider')?.buttons[0]?.clickCb();

		expect(settings.textProviders).toHaveLength(1);
		expect(settings.textProviders[0]).toMatchObject({
			id: 'new-id',
			name: 'New provider',
			type: 'openai-compatible',
			baseUrl: '',
			model: '',
		});
		expect(settings.activeTextProviderId).toBe('new-id');
		expect(saveSettings).toHaveBeenCalled();
		expect(latest('Base URL')).toBeDefined();
	});

	it('Delete removes the active config and clears the active id', async () => {
		const { settings } = setup({
			textProviders: [config],
			activeTextProviderId: 'p1',
		});
		await latest('Active provider')?.buttons[1]?.clickCb();

		expect(settings.textProviders).toEqual([]);
		expect(settings.activeTextProviderId).toBe('');
	});

	it('choosing None keeps the config but deactivates it', async () => {
		const { settings } = setup({
			textProviders: [config],
			activeTextProviderId: 'p1',
		});
		await latest('Active provider')?.dropdowns[0]?.changeCb('');

		expect(settings.textProviders).toHaveLength(1);
		expect(settings.activeTextProviderId).toBe('');
	});

	it('rejects an invalid Base URL with a notice and does not save it', async () => {
		const { settings, saveSettings } = setup({
			textProviders: [{ ...config }],
			activeTextProviderId: 'p1',
		});
		saveSettings.mockClear();
		const field = latest('Base URL')?.texts[0];
		await field?.commit('not a url');

		expect(Notice).toHaveBeenCalledWith(
			'❌ Invalid URL. Please check the base URL.',
		);
		expect(settings.textProviders[0]?.baseUrl).toBe(config.baseUrl);
		expect(field?.value).toBe(config.baseUrl);
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it('saves a valid Base URL and trims it', async () => {
		const { settings } = setup({
			textProviders: [{ ...config }],
			activeTextProviderId: 'p1',
		});
		await latest('Base URL')?.texts[0]?.commit(
			'  https://openrouter.ai/api/v1 ',
		);

		expect(settings.textProviders[0]?.baseUrl).toBe(
			'https://openrouter.ai/api/v1',
		);
	});

	it('rejects an empty name', async () => {
		const { settings } = setup({
			textProviders: [{ ...config }],
			activeTextProviderId: 'p1',
		});
		await latest('Name')?.texts[0]?.commit('   ');

		expect(Notice).toHaveBeenCalledWith('❌ Name cannot be empty.');
		expect(settings.textProviders[0]?.name).toBe('Local');
	});

	it('stores the API key and model as typed, masks the key field', async () => {
		const { settings } = setup({
			textProviders: [{ ...config }],
			activeTextProviderId: 'p1',
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

	it('changing the type saves it', async () => {
		const { settings } = setup({
			textProviders: [{ ...config }],
			activeTextProviderId: 'p1',
		});
		await latest('Type')?.dropdowns[0]?.changeCb('anthropic');

		expect(settings.textProviders[0]?.type).toBe('anthropic');
	});

	it('labels localhost as Local and other hosts as Cloud', () => {
		const local = setup({
			textProviders: [{ ...config }],
			activeTextProviderId: 'p1',
		});
		expect(local.root.all().some((e) => e.text.startsWith('Local:'))).toBe(
			true,
		);

		const cloud = setup({
			textProviders: [
				{ ...config, baseUrl: 'https://openrouter.ai/api/v1' },
			],
			activeTextProviderId: 'p1',
		});
		expect(cloud.root.all().some((e) => e.text.startsWith('Cloud:'))).toBe(
			true,
		);
	});

	describe('API key source', () => {
		it('offers manual and keychain, and switching to keychain shows the secret picker', async () => {
			const { settings } = setup({ textProviders: [{ ...config }], activeTextProviderId: 'p1' });
			expect(latest('API key')?.texts).toHaveLength(1);

			const source = latest('API key source')?.dropdowns[0];
			expect(source?.options).toEqual({ manual: 'Enter manually', keychain: 'Obsidian keychain' });
			await source?.changeCb('keychain');

			expect(settings.textProviders[0]?.apiKeySource).toBe('keychain');
			expect(latest('API key')?.texts).toHaveLength(0);
			expect(latest('API key')?.components).toHaveLength(1);
		});

		it('stores only the secret name, never the key value', async () => {
			const { settings } = setup({
				textProviders: [{ ...config, apiKeySource: 'keychain' }],
				activeTextProviderId: 'p1',
			});
			const secret = secrets[secrets.length - 1] as FakeSecret;
			await secret.changeCb('my-key');

			expect(settings.textProviders[0]?.apiKeySecretId).toBe('my-key');
			expect(JSON.stringify(settings)).not.toContain('test-secret');
			// The lookup used for the model listing resolves the secret from the keychain.
			expect(listModels).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: 'test-secret' }));
		});
	});

	describe('model list', () => {
		const withUrl = { ...config, model: '' };

		it('does not touch the network just by rendering', () => {
			setup({ textProviders: [{ ...config }], activeTextProviderId: 'p1' });

			expect(listModels).not.toHaveBeenCalled();
			expect(latest('Model')?.texts).toHaveLength(1); // free text until models are known
		});

		it('fetches after the Base URL is saved and shows a select of the models', async () => {
			listModels.mockResolvedValue(['llama3.1', 'qwen2.5']);
			const { settings } = setup({ textProviders: [{ ...withUrl }], activeTextProviderId: 'p1' });

			await latest('Base URL')?.texts[0]?.commit('http://localhost:11434/v1');

			expect(listModels).toHaveBeenCalledWith(
				expect.objectContaining({ baseUrl: 'http://localhost:11434/v1', type: 'openai-compatible' }),
			);
			const model = latest('Model');
			expect(model?.texts).toHaveLength(0);
			expect(model?.dropdowns[0]?.options).toEqual({ '': 'Select a model…', 'llama3.1': 'llama3.1', 'qwen2.5': 'qwen2.5' });

			await model?.dropdowns[0]?.changeCb('qwen2.5');
			expect(settings.textProviders[0]?.model).toBe('qwen2.5');
		});

		it('keeps a saved model the endpoint does not list', async () => {
			listModels.mockResolvedValue(['a']);
			setup({ textProviders: [{ ...config, model: 'old-model' }], activeTextProviderId: 'p1' });
			const refresh = [...(rendered as FakeSetting[])].reverse().find((s) => s.name === 'Model')?.buttons[0];
			await refresh?.clickCb();

			expect(latest('Model')?.dropdowns[0]?.options).toHaveProperty('old-model');
		});

		it('falls back to a text field with a hint when listing fails', async () => {
			listModels.mockRejectedValue(new ProviderError('openai-compatible', 'HTTP 404 from https://x/v1/models'));
			setup({ textProviders: [{ ...config }], activeTextProviderId: 'p1' });
			await latest('Model')?.buttons[0]?.clickCb();

			const model = latest('Model');
			expect(model?.texts).toHaveLength(1);
			expect(model?.desc).toBe(
				"Couldn't load models: openai-compatible: HTTP 404 from https://x/v1/models. Type the model name instead.",
			);
		});

		it('Refresh refetches, and is disabled while there is no Base URL', async () => {
			listModels.mockResolvedValue(['a']);
			setup({ textProviders: [{ ...config }], activeTextProviderId: 'p1' });
			await latest('Model')?.buttons[0]?.clickCb();
			await latest('Model')?.buttons[0]?.clickCb();
			expect(listModels).toHaveBeenCalledTimes(2);

			rendered.length = 0;
			setup({ textProviders: [{ ...config, id: 'p2', baseUrl: '' }], activeTextProviderId: 'p2' });
			expect(latest('Model')?.buttons[0]?.disabled).toBe(true);
		});

		it('changing the type refetches', async () => {
			listModels.mockResolvedValue(['claude-x']);
			setup({ textProviders: [{ ...config }], activeTextProviderId: 'p1' });
			await latest('Type')?.dropdowns[0]?.changeCb('anthropic');

			expect(listModels).toHaveBeenCalledWith(expect.objectContaining({ type: 'anthropic' }));
		});
	});
});
