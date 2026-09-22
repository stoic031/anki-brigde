import { beforeEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_SETTINGS, type AnkiBridgeSettings } from '../settings';
import { DEFAULT_MEDIA_PREFIX } from '../utils/constants';

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
}));

import { renderMediaSection } from './mediaSection';

function fakePlugin(overrides: Partial<AnkiBridgeSettings> = {}) {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, ...overrides },
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	return { plugin, saveSettings };
}

function render(plugin: AnkiBridgePlugin) {
	renderMediaSection({} as HTMLElement, plugin);
}

beforeEach(() => {
	Notice.mockClear();
	settings.length = 0;
});

describe('renderMediaSection', () => {
	it('renders the field with the default placeholder and the current saved value', () => {
		const { plugin } = fakePlugin({ mediaPrefix: '_custom_' });

		render(plugin);

		const text = settings[0]?.textComponents[0];
		expect(text?.placeholder).toBe(DEFAULT_MEDIA_PREFIX);
		expect(text?.value).toBe('_custom_');
	});

	it('saves a valid prefix and calls plugin.saveSettings', async () => {
		const { plugin, saveSettings } = fakePlugin();

		render(plugin);
		await settings[0]?.textComponents[0]?.triggerChange('_custom_');

		expect(plugin.settings.mediaPrefix).toBe('_custom_');
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});

	it('shows a Notice and does not save an empty prefix', async () => {
		const { plugin, saveSettings } = fakePlugin({
			mediaPrefix: '_obsidian_',
		});

		render(plugin);
		await settings[0]?.textComponents[0]?.triggerChange('   ');

		expect(Notice).toHaveBeenCalledWith(
			'❌ Invalid prefix. It cannot be empty or contain special/path characters.',
		);
		expect(plugin.settings.mediaPrefix).toBe('_obsidian_');
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it('shows a Notice and does not save a prefix with path/special characters', async () => {
		const { plugin, saveSettings } = fakePlugin({
			mediaPrefix: '_obsidian_',
		});

		render(plugin);
		await settings[0]?.textComponents[0]?.triggerChange('bad/prefix');

		expect(Notice).toHaveBeenCalledWith(
			'❌ Invalid prefix. It cannot be empty or contain special/path characters.',
		);
		expect(plugin.settings.mediaPrefix).toBe('_obsidian_');
		expect(saveSettings).not.toHaveBeenCalled();
	});
});
