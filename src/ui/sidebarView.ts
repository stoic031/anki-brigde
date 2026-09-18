import {
	App,
	ButtonComponent,
	DropdownComponent,
	ItemView,
	Setting,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { readAnkiFrontmatter, writeAnkiFrontmatter } from '../sync/parser';
import { fieldConfigKey, resolveAnkiConnectUrl } from '../settings';
import type { AnkiFrontmatter } from '../types';
import { buildFolderTreeEntries } from '../utils/folderTree';
import { toastError } from './toast';
import { DeckModelChangeWarningModal } from './modals/deckModelChangeWarning';

export const VIEW_TYPE_SIDEBAR = 'anki-bridge-sidebar';

// docs/design/07-sidebar.md §7.1 — registered unconditionally on load; opening it
// (ribbon icon / commands) is handled by sibling tasks #134-#136.
export class SidebarView extends ItemView {
	private deckDropdown?: DropdownComponent;
	private modelDropdown?: DropdownComponent;
	private folderDropdown?: DropdownComponent;
	// Set once the user actually picks a value from the Folder dropdown — distinguishes
	// an explicit "vault root" choice from '' just meaning "never customized," so a
	// later 🔄 click (which re-runs populateFolderDropdown()) doesn't silently revert
	// it back to the active note's folder. Deliberately not persisted: on a fresh
	// SidebarView instance (e.g. after reopening the view), '' still means "unset" and
	// re-derives from the active note, same as before this fix.
	private folderExplicitlySelected = false;
	private fieldsContainerEl?: HTMLElement;
	private connectionStatusSetting?: Setting;
	private refreshButton?: ButtonComponent;

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
		this.renderConnectionStatus();
		await this.testConnection();
		this.renderDeckDropdown();
		await this.refreshDecks();
		this.renderModelDropdown();
		await this.refreshModels();
		this.renderFolderDropdown();
		await this.populateFolderDropdown();
		this.fieldsContainerEl = this.contentEl.createDiv({
			cls: 'anki-bridge-sidebar__field-checkboxes',
		});
		await this.renderFieldCheckboxes();
	}

	// docs/design/07-sidebar.md §7.2.1 — Deck dropdown. Refresh is handled by the single
	// 🔄 button on the Connection Status row (see renderConnectionStatus()), not per-dropdown.
	private renderDeckDropdown(): void {
		new Setting(this.contentEl)
			.setName('Deck')
			.addDropdown((dropdown) => {
				this.deckDropdown = dropdown;
				dropdown.onChange(async (value) => {
					await this.handleSelectionChange('currentDeck', value, dropdown);
				});
			});
	}

	private async refreshDecks(): Promise<void> {
		if (!this.deckDropdown) return;
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			const deckNames = await client.deckNames();

			this.deckDropdown.selectEl.empty();
			for (const name of deckNames)
				this.deckDropdown.addOption(name, name);

			const current = this.plugin.settings.currentDeck;
			if (current && deckNames.includes(current)) {
				this.deckDropdown.setValue(current);
			}
		} catch {
			toastError(
				'❌ Failed to load decks. Please check Anki connection.',
			);
		}
	}

	// docs/design/07-sidebar.md §7.2.1 — Model dropdown. Refresh is handled by the single
	// 🔄 button on the Connection Status row (see renderConnectionStatus()), not per-dropdown.
	private renderModelDropdown(): void {
		new Setting(this.contentEl)
			.setName('Model')
			.addDropdown((dropdown) => {
				this.modelDropdown = dropdown;
				dropdown.onChange(async (value) => {
					await this.handleSelectionChange('currentModel', value, dropdown);
				});
			});
	}

	private async refreshModels(): Promise<void> {
		if (!this.modelDropdown) return;
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			const modelNames = await client.modelNames();

			this.modelDropdown.selectEl.empty();
			for (const name of modelNames)
				this.modelDropdown.addOption(name, name);

			const current = this.plugin.settings.currentModel;
			if (current && modelNames.includes(current)) {
				this.modelDropdown.setValue(current);
			}
		} catch {
			toastError(
				'❌ Failed to load models. Please check Anki connection.',
			);
		}
	}

	// docs/design/scenarios.md Scenario 4 / docs/design/07-sidebar.md §7.3 — changing
	// Deck/Model while the active note already has anki_note_id needs a warning modal
	// instead of applying immediately; unsynced (or no active note) applies right away.
	private async handleSelectionChange(
		key: 'currentDeck' | 'currentModel',
		value: string,
		dropdown: DropdownComponent,
	): Promise<void> {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		const isSynced =
			activeFile instanceof TFile &&
			readAnkiFrontmatter(this.plugin.app, activeFile)?.anki_note_id !== undefined;

		if (!(activeFile instanceof TFile) || !isSynced) {
			await this.applySelectionChange(key, value);
			return;
		}

		new DeckModelChangeWarningModal(
			this.plugin.app,
			// Keep old: settings[key] is still the pre-change value here, so this just
			// puts the visible dropdown back where it was.
			() => {
				dropdown.setValue(this.plugin.settings[key]);
			},
			() => void this.applyDeckModelUpdate(activeFile, key, value),
		).open();
	}

	private async applySelectionChange(
		key: 'currentDeck' | 'currentModel',
		value: string,
	): Promise<void> {
		this.plugin.settings[key] = value;
		await this.plugin.saveSettings();
		await this.renderFieldCheckboxes();
	}

	// docs/design/scenarios.md Scenario 4 — "Update": overwrite the changed field in
	// the active (already-synced) note's own frontmatter and clear anki_note_id, so
	// the next sync creates a new Anki note instead of updating the old one.
	private async applyDeckModelUpdate(
		activeFile: TFile,
		key: 'currentDeck' | 'currentModel',
		value: string,
	): Promise<void> {
		await this.applySelectionChange(key, value);
		const fieldUpdate: Partial<AnkiFrontmatter> =
			key === 'currentDeck' ? { anki_deck: value } : { anki_model: value };
		await writeAnkiFrontmatter(this.plugin.app, activeFile, {
			...fieldUpdate,
			anki_note_id: undefined,
		});
	}

	// docs/design/07-sidebar.md §7.2.1 — Folder select. Populated from the vault, not
	// AnkiConnect (no try/catch — no network call to fail). Refreshed by the single 🔄
	// button on the Connection Status row (see renderConnectionStatus()), not its own
	// button — that's also the only way a folder created after the sidebar opened shows up.
	private renderFolderDropdown(): void {
		new Setting(this.contentEl)
			.setName('Save notes to')
			.addDropdown((dropdown) => {
				this.folderDropdown = dropdown;
				dropdown.onChange(async (value) => {
					this.folderExplicitlySelected = true;
					this.plugin.settings.currentFolder = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private async populateFolderDropdown(): Promise<void> {
		if (!this.folderDropdown) return;

		// Obsidian's root TFolder.path is '' at runtime, not '/' — use isRoot(), not a
		// path comparison, to identify it.
		const folders = this.plugin.app.vault
			.getAllFolders(true)
			.filter((folder) => !folder.isRoot());
		const entries = [
			{ value: '', label: '/ (vault root)' },
			...buildFolderTreeEntries(folders),
		];

		this.folderDropdown.selectEl.empty();
		for (const { value, label } of entries) {
			this.folderDropdown.addOption(value, label);
		}

		const current = this.plugin.settings.currentFolder;
		const currentExists =
			current !== '' && folders.some((folder) => folder.path === current);
		// '' (vault root) only counts as a real, kept selection once the user has
		// explicitly chosen it via the dropdown — otherwise it's indistinguishable from
		// "never customized," and re-deriving from the active note's folder below is the
		// more useful default. Without folderExplicitlySelected, every 🔄 click (which
		// re-runs this) would silently stomp an explicit "root" choice back to whatever
		// folder the active note happens to be in.
		if (currentExists || (current === '' && this.folderExplicitlySelected)) {
			this.folderDropdown.setValue(current);
			return;
		}

		// No saved folder yet, or the saved folder was deleted — default to the active
		// note's folder (vault root if none). '' means both "vault root" and "unset"
		// for this setting (see settings.ts) until folderExplicitlySelected is set, so
		// picking root from the dropdown for the first time is indistinguishable from
		// never having customized it: the next time the sidebar opens (a fresh
		// SidebarView instance, folderExplicitlySelected reset), it will re-derive from
		// whichever note is active then rather than staying pinned to root. Accepted
		// tradeoff, not a bug to "fix" here — see folderExplicitlySelected's own comment
		// for why a 🔄 click *within* the same session no longer has this problem.
		const activeParent = this.plugin.app.workspace.getActiveFile()?.parent;
		const fallback =
			!activeParent || activeParent.isRoot() ? '' : activeParent.path;
		this.folderDropdown.setValue(fallback);
		this.plugin.settings.currentFolder = fallback;
		await this.plugin.saveSettings();
	}

	// docs/design/07-sidebar.md §7.2.1 — Field checkboxes, only shown once Deck + Model
	// are both selected. Re-invoked from the Deck/Model onChange handlers above and from
	// handleRefreshAllClick() (there's no per-field Refresh button) since the field list
	// and the saved ticks both depend on which Deck+Model pair is currently selected.
	private async renderFieldCheckboxes(): Promise<void> {
		if (!this.fieldsContainerEl) return;
		this.fieldsContainerEl.empty();

		const { currentDeck: deck, currentModel: model } = this.plugin.settings;
		if (!deck || !model) return;

		let fields: string[];
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			fields = await client.modelFieldNames(model);
		} catch {
			toastError(
				'❌ Failed to load fields. Please check Anki connection.',
			);
			return;
		}

		this.fieldsContainerEl.createEl('p', {
			text: 'Fields to generate with AI:',
		});

		const key = fieldConfigKey(deck, model);
		const selected = new Set(
			this.plugin.settings.generateWithAiFields[key],
		);

		for (const field of fields) {
			new Setting(this.fieldsContainerEl)
				.setName(field)
				.addToggle((toggle) => {
					toggle.setValue(selected.has(field));
					toggle.onChange(async (value) => {
						await this.setFieldSelected(deck, model, field, value);
					});
				});
		}
	}

	private async setFieldSelected(
		deck: string,
		model: string,
		field: string,
		selected: boolean,
	): Promise<void> {
		const key = fieldConfigKey(deck, model);
		const current = new Set(this.plugin.settings.generateWithAiFields[key]);
		if (selected) current.add(field);
		else current.delete(field);
		this.plugin.settings.generateWithAiFields[key] = [...current];
		await this.plugin.saveSettings();
	}

	// docs/design/07-sidebar.md §7.2.1 — Connection Status, now the first control in Tab 1.
	// Uses AnkiConnect's `version` action (lightweight, built for exactly this) rather
	// than deckNames/modelNames. Unlike the other Tab 1 controls, failure is shown inline
	// in the persistent status line rather than via toastError — a toast on top of an
	// always-visible status indicator would be redundant. The 🔄 button doubles as the
	// single refresh point for the whole tab (see handleRefreshAllClick()) instead of
	// separate per-dropdown Refresh buttons.
	private renderConnectionStatus(): void {
		this.connectionStatusSetting = new Setting(this.contentEl)
			.setName('Status: ⏳ Checking...')
			.setDesc(`AnkiConnect: ${resolveAnkiConnectUrl(this.plugin.settings)}`)
			.addButton((btn) => {
				this.refreshButton = btn;
				btn.setButtonText('🔄').onClick(() => this.handleRefreshAllClick());
			});
	}

	// Manual click only (not onOpen()'s automatic check below). Folder refresh always
	// runs — it's vault-local, not an AnkiConnect call, so it never needs gating on
	// connection success. Decks/models/fields stay gated on a successful connection
	// check to avoid firing two more toastErrors on top of an already-visible "can't
	// connect" status line when Anki is confirmed still down.
	private async handleRefreshAllClick(): Promise<void> {
		const connected = await this.testConnection();
		await this.populateFolderDropdown();
		if (connected) {
			await this.refreshDecks();
			await this.refreshModels();
			await this.renderFieldCheckboxes();
		}
	}

	private async testConnection(): Promise<boolean> {
		this.refreshButton?.setDisabled(true);
		this.connectionStatusSetting?.setName('Status: ⏳ Checking...');
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			await client.version();
			this.connectionStatusSetting?.setName('Status: ✅ Connected');
			return true;
		} catch {
			this.connectionStatusSetting?.setName(
				'Status: ❌ Cannot connect to Anki. Please check URL and AnkiConnect.',
			);
			return false;
		} finally {
			this.refreshButton?.setDisabled(false);
		}
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
