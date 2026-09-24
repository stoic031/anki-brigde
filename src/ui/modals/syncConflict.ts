import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';

export type ConflictChoice = 'obsidian' | 'anki' | null; // null = cancelled

// docs/design/01-sync.md §1.1 — Sync found edits made in Anki since the last sync.
// Closing the modal any other way (Esc, ×) counts as Cancel.
export class SyncConflictModal extends Modal {
	private chosen = false;

	constructor(
		app: App,
		private onChoice: (choice: ConflictChoice) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Note changed in Anki');
		this.contentEl.createEl('p', {
			text: 'This note was edited in Anki since the last sync. Which version do you want to keep?',
		});
		new Setting(this.contentEl)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => this.choose(null)),
			)
			.addButton((btn) =>
				btn
					.setButtonText('Use Anki version')
					.onClick(() => this.choose('anki')),
			)
			.addButton((btn) =>
				btn
					.setButtonText('Keep Obsidian version')
					// Overwrites the Anki edits.
					// eslint-disable-next-line @typescript-eslint/no-deprecated -- setDestructive() is 1.13.0+, above minAppVersion
					.setWarning()
					.onClick(() => this.choose('obsidian')),
			);
	}

	private choose(choice: ConflictChoice): void {
		this.chosen = true;
		this.close();
		this.onChoice(choice);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.chosen) {
			this.chosen = true;
			this.onChoice(null);
		}
	}
}
