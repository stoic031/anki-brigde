import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_SIDEBAR = 'anki-bridge-sidebar';

// docs/design/07-sidebar.md §7.1 — registered unconditionally on load; opening it
// (ribbon icon / commands) is handled by sibling tasks #134-#136.
export class SidebarView extends ItemView {
	getViewType(): string {
		return VIEW_TYPE_SIDEBAR;
	}

	getDisplayText(): string {
		return 'Anki Bridge';
	}

	getIcon(): string {
		return 'graduation-cap';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.createEl('h4', { text: 'Anki Bridge' });
	}
}

export function registerSidebarView(plugin: Plugin): void {
	plugin.registerView(
		VIEW_TYPE_SIDEBAR,
		(leaf: WorkspaceLeaf) => new SidebarView(leaf),
	);
}
