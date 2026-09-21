import {
	App,
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
import { resolveAnkiConnectUrl } from '../settings';
import { PROFILE_CHANGED_EVENT } from '../utils/constants';
import { toastError } from './toast';
import { DeckModelChangeWarningModal } from './modals/deckModelChangeWarning';
import { renderNoteActions, type NoteActions } from './sidebar/noteActions';
import { renderTabs } from './sidebar/tabs';
import { renderImageTab, type ImageTab } from './sidebar/imageTab';
import { renderTextTab, type TextTab } from './sidebar/textTab';

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
	private noteActions?: NoteActions;
	private textTab?: TextTab;
	private imageTab?: ImageTab;

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

		// docs/design/07-sidebar.md §7.2 — Profile sits above the tabs (it is about new
		// notes); everything below is about the active note.
		const panels = renderTabs(this.contentEl, [
			{ id: 'note', label: 'Note' },
			{ id: 'text', label: 'Text' },
		{ id: 'image', label: 'Image' },
		]);
		const notePanel = panels.note;
		const textPanel = panels.text;
		const imagePanel = panels.image;
		if (!notePanel || !textPanel || !imagePanel) return;
		this.renderDeckDropdown(notePanel);
		this.renderModelDropdown(notePanel);
		this.noteActions = renderNoteActions(notePanel, this.plugin);
		this.textTab = renderTextTab(textPanel, this.plugin, () => this.getActiveNote());
		this.imageTab = renderImageTab(imagePanel, this.plugin);

		// docs/design/07-sidebar.md §7.2.1 — everything below mirrors the active note's
		// frontmatter, so it re-syncs on every note switch and whenever its metadata
		// changes (our own writes, or the user editing YAML). 'changed' fires on every
		// edit, hence the pair check inside TextTab.sync().
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

		await this.refreshDecks();
		await this.refreshModels();
		await this.syncFromNote();
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
	private renderDeckDropdown(parent: HTMLElement): void {
		new Setting(parent)
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
	private renderModelDropdown(parent: HTMLElement): void {
		new Setting(parent)
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
		this.noteActions?.update({
			note: this.getActiveNote(),
			model,
			synced: this.isSynced(),
		});
	}

	private isSynced(): boolean {
		const note = this.getActiveNote();
		return (
			note !== null &&
			readAnkiFrontmatter(this.plugin.app, note)?.anki_note_id !== undefined
		);
	}

	// Re-reads everything that mirrors the active note: dropdown values, action-row
	// state, and the Text and Image tabs' field lists.
	private async syncFromNote(): Promise<void> {
		this.renderDropdownValues();
		const { deck, model } = this.getNoteDeckModel();
		await this.textTab?.sync(deck, model);
		await this.imageTab?.sync(deck, model);
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

		if (!this.isSynced()) {
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
