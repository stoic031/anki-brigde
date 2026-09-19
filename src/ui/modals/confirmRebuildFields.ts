import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';

// docs/design/07-sidebar.md §7.2.1 — Rebuild fields: confirm before the note body is
// replaced with the current Model's skeleton.
export class ConfirmRebuildFieldsModal extends Modal {
	constructor(
		app: App,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Rebuild note fields?');
		this.contentEl.createEl('p', {
			text: 'This deletes everything below the note properties and creates one empty section per field of its Model. This cannot be undone.',
		});
		new Setting(this.contentEl)
			.addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText('Rebuild')
					// setWarning() — same minAppVersion tradeoff as ConfirmDeleteModal.
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
