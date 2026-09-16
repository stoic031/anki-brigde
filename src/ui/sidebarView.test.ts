import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Plugin, WorkspaceLeaf } from 'obsidian';

const { ItemView, contentElEmpty, contentElCreateEl } = vi.hoisted(() => {
	const contentElEmpty = vi.fn();
	const contentElCreateEl = vi.fn();
	class ItemView {
		contentEl = { empty: contentElEmpty, createEl: contentElCreateEl };
		constructor(public leaf: unknown) {}
	}
	return { ItemView, contentElEmpty, contentElCreateEl };
});
vi.mock('obsidian', () => ({ ItemView }));

import { SidebarView, VIEW_TYPE_SIDEBAR, registerSidebarView } from './sidebarView';

afterEach(() => {
	vi.clearAllMocks();
});

describe('SidebarView', () => {
	it('reports its view type', () => {
		const view = new SidebarView({} as WorkspaceLeaf);

		expect(view.getViewType()).toBe(VIEW_TYPE_SIDEBAR);
	});

	it('has a display text and icon', () => {
		const view = new SidebarView({} as WorkspaceLeaf);

		expect(view.getDisplayText()).toBe('Anki Bridge');
		expect(view.getIcon()).toBeTruthy();
	});

	it('renders a placeholder on open without throwing', async () => {
		const view = new SidebarView({} as WorkspaceLeaf);

		await expect(view.onOpen()).resolves.toBeUndefined();
		expect(contentElEmpty).toHaveBeenCalled();
		expect(contentElCreateEl).toHaveBeenCalledWith('h4', {
			text: 'Anki Bridge',
		});
	});
});

describe('registerSidebarView', () => {
	it('registers the sidebar view type with a factory function', () => {
		const registerView = vi.fn();
		const plugin = { registerView } as unknown as Plugin;

		registerSidebarView(plugin);

		expect(registerView).toHaveBeenCalledWith(
			VIEW_TYPE_SIDEBAR,
			expect.any(Function),
		);
	});
});
