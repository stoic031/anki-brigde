import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';

// docs/design/scenarios.md Scenario 4 / docs/design/07-sidebar.md §7.3 — shown when the
// user changes Deck/Model in Sidebar Tab 1 while the active note already has
// anki_note_id (already synced to Anki).
export class DeckModelChangeWarningModal extends Modal {
	constructor(
		app: App,
		private onKeepOld: () => void,
		private onUpdate: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Change Deck/Model for this note?');
		this.contentEl.createEl('p', {
			text: 'This note is already synced to Anki under a different Deck/Model. Updating will create a new note in Anki the next time you sync.',
		});
		new Setting(this.contentEl)
			.addButton((btn) =>
				btn.setButtonText('Keep old').onClick(() => {
					this.close();
					this.onKeepOld();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText('Update')
					// setWarning() needs Obsidian 1.13.0+; manifest.json's minAppVersion is
					// 1.7.2, so this uses the deprecated-but-supported setWarning() instead
					// (same tradeoff as ConfirmDeleteModal's Delete button).
					.setWarning()
					.onClick(() => {
						this.close();
						this.onUpdate();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
