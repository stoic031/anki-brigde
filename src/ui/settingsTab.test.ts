import { beforeEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_ANKI_CONNECT_URL } from '../utils/constants';

class FakeTextComponent {
	placeholder = '';
	value = '';
	private changeCb: ((v: string) => unknown) | null = null;

	setPlaceholder(p: string) {
		this.placeholder = p;
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
	async triggerChange(v: string) {
		this.value = v;
		await this.changeCb?.(v);
	}
}

class FakeSetting {
	name = '';
	desc = '';
	textComponents: FakeTextComponent[] = [];

	constructor(public containerEl: unknown) {}
	setName(n: string) {
		this.name = n;
		return this;
	}
	setDesc(d: string) {
		this.desc = d;
		return this;
	}
	addText(cb: (t: FakeTextComponent) => unknown) {
		const text = new FakeTextComponent();
		cb(text);
		this.textComponents.push(text);
		return this;
	}
}

const { Notice, settings } = vi.hoisted(() => ({
	Notice: vi.fn(),
	settings: [] as FakeSetting[],
}));
vi.mock('obsidian', () => ({
	Notice,
	Setting: class {
		constructor(containerEl: unknown) {
			const s = new FakeSetting(containerEl);
			settings.push(s);
			return s;
		}
	},
	PluginSettingTab: class {},
}));

import { renderConnectionSection } from './settingsTab';

// Returns the spy as a plain local (not read back off `plugin`) so assertions like
// `expect(saveSettings).toHaveBeenCalled()` don't trip @typescript-eslint/unbound-method.
function fakePlugin(ankiConnectUrl: string): {
	plugin: AnkiBridgePlugin;
	saveSettings: ReturnType<typeof vi.fn>;
} {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: { ankiConnectUrl },
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	return { plugin, saveSettings };
}

beforeEach(() => {
	Notice.mockClear();
	settings.length = 0;
});

describe('renderConnectionSection', () => {
	it('renders the URL field with the placeholder and the current saved value', () => {
		const { plugin } = fakePlugin('http://localhost:9999');

		renderConnectionSection({} as HTMLElement, plugin);

		const text = settings[0]?.textComponents[0];
		expect(text?.placeholder).toBe(DEFAULT_ANKI_CONNECT_URL);
		expect(text?.value).toBe('http://localhost:9999');
	});

	it('saves a valid URL and calls plugin.saveSettings', async () => {
		const { plugin, saveSettings } = fakePlugin('');

		renderConnectionSection({} as HTMLElement, plugin);
		const text = settings[0]?.textComponents[0];
		await text?.triggerChange('http://localhost:1234');

		expect(plugin.settings.ankiConnectUrl).toBe('http://localhost:1234');
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});

	it('saves a blank value as-is (resolves to the default elsewhere)', async () => {
		const { plugin, saveSettings } = fakePlugin('http://localhost:1234');

		renderConnectionSection({} as HTMLElement, plugin);
		const text = settings[0]?.textComponents[0];
		await text?.triggerChange('   ');

		expect(plugin.settings.ankiConnectUrl).toBe('');
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});

	it('shows a Notice and does not save an invalid, non-blank URL', async () => {
		const { plugin, saveSettings } = fakePlugin('http://localhost:1234');

		renderConnectionSection({} as HTMLElement, plugin);
		const text = settings[0]?.textComponents[0];
		await text?.triggerChange('not a url');

		expect(Notice).toHaveBeenCalledWith(
			'❌ Invalid URL. Please check the AnkiConnect URL.',
		);
		expect(plugin.settings.ankiConnectUrl).toBe('http://localhost:1234');
		expect(saveSettings).not.toHaveBeenCalled();
	});
});
