import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';

// docs/design/07-sidebar.md §7.3 steps [3]-[4] — prompts for the new note's name.
// onSubmit receives null on Cancel/Escape/click-outside (no note created).
export class NoteNameModal extends Modal {
	private submitted = false;

	constructor(
		app: App,
		private onSubmit: (name: string | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Enter note name:');

		let name = '';
		new Setting(this.contentEl).addText((text) => {
			text.onChange((value) => {
				name = value;
			});
			// Modal (unlike View) doesn't extend Component, so there's no
			// registerDomEvent to use here; contentEl.empty() in onClose() removes
			// this input from the DOM along with its listener.
			text.inputEl.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter') this.submit(name);
			});
		});
		new Setting(this.contentEl)
			.addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText('Create')
					.setCta()
					.onClick(() => this.submit(name)),
			);
	}

	private submit(name: string): void {
		this.submitted = true;
		this.close();
		this.onSubmit(name);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.submitted) this.onSubmit(null);
	}
}
