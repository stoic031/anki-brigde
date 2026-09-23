import { beforeEach, describe, expect, it, vi } from 'vitest';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_SETTINGS, type AnkiBridgeSettings } from '../settings';

class FakeToggleComponent {
	value = false;
	private changeCb: ((v: boolean) => unknown) | null = null;

	setValue(v: boolean) {
		this.value = v;
		return this;
	}
	onChange(cb: (v: boolean) => unknown) {
		this.changeCb = cb;
		return this;
	}
	async triggerChange(v: boolean) {
		this.value = v;
		await this.changeCb?.(v);
	}
}

class FakeSetting {
	name = '';
	desc = '';
	toggleComponents: FakeToggleComponent[] = [];

	constructor(public containerEl: unknown) {}
	setName(n: string) {
		this.name = n;
		return this;
	}
	setDesc(d: string) {
		this.desc = d;
		return this;
	}
	addToggle(cb: (t: FakeToggleComponent) => unknown) {
		const toggle = new FakeToggleComponent();
		cb(toggle);
		this.toggleComponents.push(toggle);
		return this;
	}
}

const { settings } = vi.hoisted(() => ({ settings: [] as FakeSetting[] }));
vi.mock('obsidian', () => ({
	Setting: class {
		constructor(containerEl: unknown) {
			const s = new FakeSetting(containerEl);
			settings.push(s);
			return s;
		}
	},
}));

import { renderSyncSection } from './syncSection';

function fakePlugin(overrides: Partial<AnkiBridgeSettings> = {}) {
	const saveSettings = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, ...overrides },
		saveSettings,
	} as unknown as AnkiBridgePlugin;
	return { plugin, saveSettings };
}

function render(plugin: AnkiBridgePlugin) {
	renderSyncSection({} as HTMLElement, plugin);
}

beforeEach(() => {
	settings.length = 0;
});

describe('renderSyncSection', () => {
	it('renders the toggle with the current saved value', () => {
		const { plugin } = fakePlugin({ autoSyncOnSave: true });

		render(plugin);

		expect(settings[0]?.toggleComponents[0]?.value).toBe(true);
	});

	it('defaults to off', () => {
		const { plugin } = fakePlugin();

		render(plugin);

		expect(settings[0]?.toggleComponents[0]?.value).toBe(false);
	});

	it('saves the new value when toggled on', async () => {
		const { plugin, saveSettings } = fakePlugin({ autoSyncOnSave: false });

		render(plugin);
		await settings[0]?.toggleComponents[0]?.triggerChange(true);

		expect(plugin.settings.autoSyncOnSave).toBe(true);
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});

	it('saves the new value when toggled off', async () => {
		const { plugin, saveSettings } = fakePlugin({ autoSyncOnSave: true });

		render(plugin);
		await settings[0]?.toggleComponents[0]?.triggerChange(false);

		expect(plugin.settings.autoSyncOnSave).toBe(false);
		expect(saveSettings).toHaveBeenCalledTimes(1);
	});
});
