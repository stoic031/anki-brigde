import {
	App,
	ButtonComponent,
	DropdownComponent,
	Events,
	ItemView,
	Setting,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { readAnkiFrontmatter, writeAnkiFrontmatter } from '../sync/parser';
import { fieldConfigKey, resolveAnkiConnectUrl } from '../settings';
import { PROFILE_CHANGED_EVENT } from '../utils/constants';
import { rebuildContent } from '../note/contentTemplate';
import { toastError, toastSuccess } from './toast';
import { ConfirmRebuildFieldsModal } from './modals/confirmRebuildFields';
import { DeckModelChangeWarningModal } from './modals/deckModelChangeWarning';

export const VIEW_TYPE_SIDEBAR = 'anki-bridge-sidebar';

// docs/design/07-sidebar.md §7.1 — registered unconditionally on load; opening it
// (ribbon icon / commands) is handled by sibling tasks #134-#136.
export class SidebarView extends ItemView {
	private deckDropdown?: DropdownComponent;
	private modelDropdown?: DropdownComponent;
	private profileDropdown?: DropdownComponent;
	// Last fetched from AnkiConnect; the Deck/Model dropdowns list these, but their
	// *value* always comes from the active note's frontmatter (see renderDropdownValues()).
	private deckNames: string[] = [];
	private modelNames: string[] = [];
	// fieldConfigKey of the pair the field checkboxes were last rendered for — lets
	// syncFromNote() skip re-fetching fields on metadata events that didn't change it.
	private renderedFieldsKey = '';
	private fieldsContainerEl?: HTMLElement;
	private rebuildButton?: ButtonComponent;

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
		this.renderProfileDropdown();
		this.renderDeckDropdown();
		await this.refreshDecks();
		this.renderModelDropdown();
		await this.refreshModels();
		this.renderRebuildButton();
		this.fieldsContainerEl = this.contentEl.createDiv({
			cls: 'anki-bridge-sidebar__field-checkboxes',
		});
		await this.syncFromNote();

		// docs/design/07-sidebar.md §7.2.1 — Deck/Model dropdowns and the field-checkbox
		// list mirror the active note's frontmatter, so they re-sync on every note switch
		// and whenever its metadata changes (our own writes, or the user editing YAML).
		// 'changed' fires on every edit, hence syncFromNote()'s key check.
		this.registerEvent(
			this.plugin.app.workspace.on('file-open', () => {
				void this.syncFromNote();
			}),
		);
		this.registerEvent(
			this.plugin.app.metadataCache.on('changed', (file) => {
				if (file === this.plugin.app.workspace.getActiveFile()) {
					void this.syncFromNote();
				}
			}),
		);
		// Workspace's typed overloads don't know custom event names; Events' generic one does.
		const workspaceEvents: Events = this.plugin.app.workspace;
		this.registerEvent(
			workspaceEvents.on(PROFILE_CHANGED_EVENT, () =>
				this.renderProfileDropdownOptions(),
			),
		);
	}

	// docs/design/07-sidebar.md §7.2.1 — Profile select. Picks the Deck/Model/folder used
	// for *new* notes (Create note, Create note from selection); synced with Settings tab.
	private renderProfileDropdown(): void {
		new Setting(this.contentEl).setName('Profile').addDropdown((dropdown) => {
			this.profileDropdown = dropdown;
			dropdown.onChange(
				(id) => void this.plugin.setActiveProfile(id),
			);
			this.renderProfileDropdownOptions();
		});
	}

	private renderProfileDropdownOptions(): void {
		const dropdown = this.profileDropdown;
		if (!dropdown) return;
		const { profiles, activeProfileId } = this.plugin.settings;
		dropdown.selectEl.empty();
		for (const p of profiles) dropdown.addOption(p.id, p.name);
		dropdown.setValue(activeProfileId);
	}

	// docs/design/07-sidebar.md §7.2.1 — Deck dropdown. Shows/edits the active note's
	// anki_deck; disabled with no active note. Lists load when the sidebar opens.
	private renderDeckDropdown(): void {
		new Setting(this.contentEl)
			.setName('Deck')
			.addDropdown((dropdown) => {
				this.deckDropdown = dropdown;
				dropdown.onChange(async (value) => {
					await this.handleSelectionChange('anki_deck', value);
				});
			});
	}

	private async refreshDecks(): Promise<void> {
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			this.deckNames = await client.deckNames();
			this.renderDropdownValues();
		} catch {
			toastError(
				'❌ Failed to load decks. Please check Anki connection.',
			);
		}
	}

	// docs/design/07-sidebar.md §7.2.1 — Model dropdown; same rules as Deck above.
	private renderModelDropdown(): void {
		new Setting(this.contentEl)
			.setName('Model')
			.addDropdown((dropdown) => {
				this.modelDropdown = dropdown;
				dropdown.onChange(async (value) => {
					await this.handleSelectionChange('anki_model', value);
				});
			});
	}

	private async refreshModels(): Promise<void> {
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			this.modelNames = await client.modelNames();
			this.renderDropdownValues();
		} catch {
			toastError(
				'❌ Failed to load models. Please check Anki connection.',
			);
		}
	}

	// The active note if it's a markdown file — the only thing the Deck/Model dropdowns
	// can read from or write to.
	private getActiveNote(): TFile | null {
		const file = this.plugin.app.workspace.getActiveFile();
		return file instanceof TFile && file.extension === 'md' ? file : null;
	}

	private getNoteDeckModel(): { deck: string; model: string } {
		const note = this.getActiveNote();
		const fm = note ? readAnkiFrontmatter(this.plugin.app, note) : undefined;
		return { deck: fm?.anki_deck ?? '', model: fm?.anki_model ?? '' };
	}

	// Options come from Anki; the selected value comes from the note. A value Anki
	// doesn't list (deleted deck, Anki offline) is still shown, so the note's own truth
	// is never hidden behind a wrong-looking first option.
	private renderDropdownValues(): void {
		const hasNote = this.getActiveNote() !== null;
		const { deck, model } = this.getNoteDeckModel();
		const fill = (
			dropdown: DropdownComponent | undefined,
			names: string[],
			current: string,
		) => {
			if (!dropdown) return;
			dropdown.selectEl.empty();
			dropdown.addOption('', hasNote ? 'Not set' : 'No active note');
			for (const name of names) dropdown.addOption(name, name);
			if (current && !names.includes(current)) {
				dropdown.addOption(current, current);
			}
			dropdown.setValue(current);
			dropdown.setDisabled(!hasNote);
		};
		fill(this.deckDropdown, this.deckNames, deck);
		fill(this.modelDropdown, this.modelNames, model);
		this.rebuildButton?.setDisabled(!model);
	}

	// Re-reads the dropdown values from the note, and re-renders the field checkboxes
	// only if the note's Deck+Model pair actually changed.
	private async syncFromNote(): Promise<void> {
		this.renderDropdownValues();
		const { deck, model } = this.getNoteDeckModel();
		if (fieldConfigKey(deck, model) !== this.renderedFieldsKey) {
			await this.renderFieldCheckboxes();
		}
	}

	// docs/design/scenarios.md Scenario 4 / docs/design/07-sidebar.md §7.3 — changing
	// Deck/Model while the active note already has anki_note_id needs a warning modal
	// instead of applying immediately; unsynced notes get their frontmatter overwritten
	// directly. The dropdowns and field checkboxes then follow via the metadataCache
	// 'changed' listener in onOpen(), not by hand — the cache is stale right after a write.
	private async handleSelectionChange(
		key: 'anki_deck' | 'anki_model',
		value: string,
	): Promise<void> {
		const note = this.getActiveNote();
		// '' is the "Not set" placeholder, not a choice — snap back to the note's value.
		if (!note || value === '') {
			this.renderDropdownValues();
			return;
		}

		const isSynced =
			readAnkiFrontmatter(this.plugin.app, note)?.anki_note_id !== undefined;
		if (!isSynced) {
			await writeAnkiFrontmatter(this.plugin.app, note, { [key]: value });
			return;
		}

		new DeckModelChangeWarningModal(
			this.plugin.app,
			// Keep old: the note's frontmatter is untouched, so re-render puts the
			// visible dropdown back where it was.
			() => this.renderDropdownValues(),
			// Update: overwrite the changed field and clear anki_note_id, so the next
			// sync creates a new Anki note instead of updating the old one.
			() =>
				void writeAnkiFrontmatter(this.plugin.app, note, {
					[key]: value,
					anki_note_id: undefined,
				}),
		).open();
	}

	// docs/design/07-sidebar.md §7.2.1 — Field checkboxes for the active note's
	// Deck+Model (see getNoteDeckModel()), only shown once both are set. Re-invoked from
	// syncFromNote() when that pair changes.
	private async renderFieldCheckboxes(): Promise<void> {
		if (!this.fieldsContainerEl) return;
		this.fieldsContainerEl.empty();

		const { deck, model } = this.getNoteDeckModel();
		this.renderedFieldsKey = fieldConfigKey(deck, model);
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

	// docs/design/07-sidebar.md §7.2.1 — Rebuild fields. Replaces the note body (not the
	// frontmatter) with the skeleton for the note's current Model, e.g. after switching
	// Model. Destructive, so it always asks first.
	private renderRebuildButton(): void {
		new Setting(this.contentEl)
			.setName('Note fields')
			.setDesc(
				'Replace the note content with one empty section per field of its Model.',
			)
			.addButton((btn) => {
				this.rebuildButton = btn;
				btn.setButtonText('Rebuild fields').onClick(() => {
					const note = this.getActiveNote();
					const { model } = this.getNoteDeckModel();
					if (!note || !model) return;
					new ConfirmRebuildFieldsModal(
						this.plugin.app,
						() => void this.rebuildFields(note, model),
					).open();
				});
			});
	}

	private async rebuildFields(note: TFile, model: string): Promise<void> {
		this.rebuildButton?.setDisabled(true).setButtonText('⏳ Rebuilding...');
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(this.plugin.settings),
			);
			const fields = await client.modelFieldNames(model);
			await this.plugin.app.vault.process(note, (content) =>
				rebuildContent(content, fields),
			);
			toastSuccess('✅ Note fields rebuilt.');
		} catch {
			toastError('❌ Failed to rebuild fields. Please check Anki connection.');
		} finally {
			this.rebuildButton?.setButtonText('Rebuild fields');
			this.renderDropdownValues();
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
