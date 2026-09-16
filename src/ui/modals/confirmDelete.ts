import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';

// docs/design/03-note.md §3.2 — Delete Button: shown → confirm modal → deleteNotes
export class ConfirmDeleteModal extends Modal {
	constructor(
		app: App,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Delete note from Anki?');
		this.contentEl.createEl('p', {
			text: 'This will permanently delete the note from Anki. This cannot be undone.',
		});
		new Setting(this.contentEl)
			.addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText('Delete')
					// setDestructive() needs Obsidian 1.13.0+; manifest.json's minAppVersion is
					// 1.7.2, so this uses the deprecated-but-supported setWarning() instead.
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
