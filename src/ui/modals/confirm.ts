import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';

export interface ConfirmCopy {
	title: string;
	text: string;
	button: string;
}

// docs/design/03-note.md §3.2 (Delete) and docs/design/07-sidebar.md §7.2.1 (Rebuild
// fields): destructive actions confirm first.
export const DELETE_COPY: ConfirmCopy = {
	title: 'Delete note from Anki?',
	text: 'This will permanently delete the note from Anki. This cannot be undone.',
	button: 'Delete',
};
export const REBUILD_COPY: ConfirmCopy = {
	title: 'Rebuild note fields?',
	text: 'This deletes everything below the note properties and creates one empty section per field of its model. This cannot be undone.',
	button: 'Rebuild',
};

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private copy: ConfirmCopy,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.copy.title);
		this.contentEl.createEl('p', { text: this.copy.text });
		new Setting(this.contentEl)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => this.close()),
			)
			.addButton((btn) =>
				btn
					.setButtonText(this.copy.button)
					.setDestructive()
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
