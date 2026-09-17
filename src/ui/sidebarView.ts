import {
	App,
	DropdownComponent,
	ItemView,
	Setting,
	WorkspaceLeaf,
} from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { resolveAnkiConnectUrl } from '../settings';
import { toastError } from './toast';

export const VIEW_TYPE_SIDEBAR = 'anki-bridge-sidebar';

// docs/design/07-sidebar.md §7.1 — registered unconditionally on load; opening it
// (ribbon icon / commands) is handled by sibling tasks #134-#136.
export class SidebarView extends ItemView {
	private deckDropdown?: DropdownComponent;
	private modelDropdown?: DropdownComponent;
	private folderDropdown?: DropdownComponent;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: AnkiBridgePlugin,
	) {
		super(leaf);
	}

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
		this.renderDeckDropdown();
		await this.refreshDecks();
		this.renderModelDropdown();
		await this.refreshModels();
		this.renderFolderDropdown();
		await this.populateFolderDropdown();
	}

	// docs/design/07-sidebar.md §7.2.1 — Deck dropdown + 🔄 Refresh.
	private renderDeckDropdown(): void {
		new Setting(this.contentEl)
			.setName('Deck')
			.addDropdown((dropdown) => {
				this.deckDropdown = dropdown;
				dropdown.onChange(async (value) => {
					this.plugin.settings.currentDeck = value;
					await this.plugin.saveSettings();
				});
			})
			.addButton((btn) =>
				btn
					.setButtonText('🔄 Refresh')
					.onClick(() => void this.refreshDecks()),
			);
	}

	private async refreshDecks(): Promise<void> {
		if (!this.deckDropdown) return;
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			const deckNames = await client.deckNames();

			this.deckDropdown.selectEl.empty();
			for (const name of deckNames) this.deckDropdown.addOption(name, name);

			const current = this.plugin.settings.currentDeck;
			if (current && deckNames.includes(current)) {
				this.deckDropdown.setValue(current);
			}
		} catch {
			toastError('❌ Failed to load decks. Please check Anki connection.');
		}
	}

	// docs/design/07-sidebar.md §7.2.1 — Model dropdown + 🔄 Refresh.
	private renderModelDropdown(): void {
		new Setting(this.contentEl)
			.setName('Model')
			.addDropdown((dropdown) => {
				this.modelDropdown = dropdown;
				dropdown.onChange(async (value) => {
					this.plugin.settings.currentModel = value;
					await this.plugin.saveSettings();
				});
			})
			.addButton((btn) =>
				btn
					.setButtonText('🔄 Refresh')
					.onClick(() => void this.refreshModels()),
			);
	}

	private async refreshModels(): Promise<void> {
		if (!this.modelDropdown) return;
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			const modelNames = await client.modelNames();

			this.modelDropdown.selectEl.empty();
			for (const name of modelNames) this.modelDropdown.addOption(name, name);

			const current = this.plugin.settings.currentModel;
			if (current && modelNames.includes(current)) {
				this.modelDropdown.setValue(current);
			}
		} catch {
			toastError('❌ Failed to load models. Please check Anki connection.');
		}
	}

	// docs/design/07-sidebar.md §7.2.1 — Folder select. Populated from the vault, not
	// AnkiConnect, so no Refresh button and no try/catch (no network call to fail).
	private renderFolderDropdown(): void {
		new Setting(this.contentEl)
			.setName('Save notes to')
			.addDropdown((dropdown) => {
				this.folderDropdown = dropdown;
				dropdown.onChange(async (value) => {
					this.plugin.settings.currentFolder = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private async populateFolderDropdown(): Promise<void> {
		if (!this.folderDropdown) return;

		const folders = this.plugin.app.vault.getAllFolders(true);
		// Obsidian's root TFolder.path is '' at runtime, not '/' — use isRoot(), not a
		// path comparison, to identify it.
		const entries = [
			{ value: '', label: '/ (vault root)' },
			...folders
				.filter((folder) => !folder.isRoot())
				.map((folder) => ({ value: folder.path, label: folder.path }))
				.sort((a, b) => a.value.localeCompare(b.value)),
		];

		this.folderDropdown.selectEl.empty();
		for (const { value, label } of entries) {
			this.folderDropdown.addOption(value, label);
		}

		const current = this.plugin.settings.currentFolder;
		const currentExists =
			current !== '' &&
			folders.some((folder) => !folder.isRoot() && folder.path === current);
		if (currentExists) {
			this.folderDropdown.setValue(current);
			return;
		}

		// No saved folder yet, or the saved folder was deleted — default to the active
		// note's folder (vault root if none). '' means both "vault root" and "unset"
		// for this setting (see settings.ts), so picking root from the dropdown is
		// indistinguishable from never having customized it: the next time the sidebar
		// opens, it will re-derive from whichever note is active then rather than
		// staying pinned to root. Accepted tradeoff, not a bug to "fix" here.
		const activeParent = this.plugin.app.workspace.getActiveFile()?.parent;
		const fallback =
			!activeParent || activeParent.isRoot() ? '' : activeParent.path;
		this.folderDropdown.setValue(fallback);
		this.plugin.settings.currentFolder = fallback;
		await this.plugin.saveSettings();
	}
}

export function registerSidebarView(plugin: AnkiBridgePlugin): void {
	plugin.registerView(
		VIEW_TYPE_SIDEBAR,
		(leaf: WorkspaceLeaf) => new SidebarView(leaf, plugin),
	);
}

// docs/design/07-sidebar.md §7.3 step [7] / §3.7 step 8 — reveal the sidebar if it's
// not already open, reusing the existing leaf instead of creating a duplicate.
export async function revealSidebarView(app: App): Promise<void> {
	const [existing] = app.workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR);
	if (existing) {
		await app.workspace.revealLeaf(existing);
		return;
	}
	const leaf = app.workspace.getRightLeaf(false);
	if (!leaf) return;
	await leaf.setViewState({ type: VIEW_TYPE_SIDEBAR, active: true });
	await app.workspace.revealLeaf(leaf);
}
