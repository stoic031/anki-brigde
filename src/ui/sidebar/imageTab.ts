import { Notice, Setting, setIcon, type TFile } from 'obsidian';
import type VocabWeavePlugin from '../../main';
import {
	planAddImage,
	runAddImage,
	writeImagePrompt,
} from '../../note/addImage';
import { fieldConfigKey, type ImageFieldConfig } from '../../settings';
import { AnkiConnectError, ProviderError } from '../../types';
import { toastError, toastSuccess } from '../toast';
import { createActionButton, runAction } from './actionButton';
import { startProgressNotice } from './progressNotice';
import { loadFields } from './loadFields';

export interface ImageTab {
	// Called whenever the active note's Deck+Model may have changed. Only re-fetches the
	// field list when the pair actually differs from what is rendered.
	sync(deck: string, model: string): Promise<void>;
}

// docs/design/07-sidebar.md §7.2.2 — Image tab: which field receives the generated
// <img> tag and what to do when it already has one, saved per Deck+Model pair, plus
// the Add image button (docs/design/03-note.md §3.2).
export function renderImageTab(
	parent: HTMLElement,
	plugin: VocabWeavePlugin,
	getNote: () => TFile | null,
): ImageTab {
	const header = parent.createDiv({
		cls: 'vocabweave-sidebar__section-header',
	});
	header.createSpan({
		cls: 'vocabweave-sidebar__section-title',
		text: 'Image field mapping',
	});
	const addImage = createActionButton(header, {
		icon: 'image',
		label: 'Add image',
		variant: 'primary',
	});
	const writePrompt = createActionButton(header, {
		icon: 'pencil-line',
		label: 'Write prompt',
	});
	addImage.el.disabled = true;
	writePrompt.el.disabled = true;
	const configEl = parent.createDiv({
		cls: 'vocabweave-sidebar__image-config',
	});
	// docs/design/07-sidebar.md §7.2.2 — only shown once a prompt exists, so the tab
	// stays as short as before until the user asks for one.
	const promptEl = parent.createDiv({ cls: 'vocabweave-sidebar__prompt' });
	promptEl.hidden = true;

	let current = { deck: '', model: '' };
	let renderedKey = '';
	// In-memory only: the prompt describes one note's content, so it is dropped when
	// the active note changes. `promptNote` is the path it was written for.
	let prompt = '';
	let promptNote = '';
	let promptState: 'written' | 'drawn' | 'edited' = 'written';

	const STATE_TEXT = {
		written: 'Written by the text model. Edit it, then Add image.',
		drawn: 'Used for the last image. Edit it and Add image to redraw.',
		edited: 'Edited. Add image draws it as-is.',
	};

	const setPrompt = (
		value: string,
		state: typeof promptState,
		notePath: string,
	): void => {
		prompt = value;
		promptState = state;
		promptNote = notePath;
		renderPrompt();
	};

	const renderPrompt = (): void => {
		promptEl.empty();
		promptEl.hidden = prompt === '';
		if (promptEl.hidden) return;

		const head = promptEl.createDiv({
			cls: 'vocabweave-sidebar__section-header',
		});
		head.createSpan({
			cls: 'vocabweave-sidebar__section-title',
			text: 'Image prompt',
		});
		const discard = head.createEl('button', {
			cls: 'clickable-icon',
			attr: { type: 'button', 'aria-label': 'Discard prompt' },
		});
		setIcon(discard, 'x');
		discard.addEventListener('click', () => setPrompt('', 'written', ''));

		const area = promptEl.createEl('textarea', {
			cls: 'vocabweave-sidebar__prompt-input',
			attr: { rows: '3' },
		});
		area.value = prompt;
		const status = promptEl.createEl('p', {
			cls: 'vocabweave-sidebar__hint',
			text: STATE_TEXT[promptState],
		});
		// Per keystroke, but only the in-memory value and the status line — no
		// re-render, so the caret stays put.
		area.addEventListener('input', () => {
			prompt = area.value;
			promptState = 'edited';
			status.setText(STATE_TEXT.edited);
		});
	};

	// Both buttons call the text model and share one prompt — only one runs at a time.
	const apply = () => {
		const off =
			!current.deck ||
			!current.model ||
			addImage.busy ||
			writePrompt.busy;
		if (!addImage.busy) addImage.el.disabled = off;
		if (!writePrompt.busy) writePrompt.el.disabled = off;
	};

	addImage.el.addEventListener('click', () => {
		void onAddImage();
	});
	writePrompt.el.addEventListener('click', () => {
		void onWritePrompt();
	});

	const reportError = (err: unknown) => {
		// AnkiConnectError reaches here bare for a real, unrecognized AnkiConnect
		// error (planAddImage's modelFieldNames call) — show its own message rather
		// than the generic fallback, which would misreport it as a connection issue.
		toastError(
			err instanceof ProviderError || err instanceof AnkiConnectError
				? `❌ ${err.message}`
				: '❌ Failed to add image. Please check Anki connection.',
		);
	};

	// docs/design/07-sidebar.md §7.2.2 — text model only; nothing is drawn or written.
	const onWritePrompt = async () => {
		const note = getNote();
		if (writePrompt.el.disabled || writePrompt.busy || !note) return;
		try {
			const plan = await planAddImage(
				plugin,
				note,
				current.deck,
				current.model,
			);
			if (plan.stop !== undefined) {
				new Notice(plan.stop);
				return;
			}
			const progress = startProgressNotice('⏳ Asking the text model…');
			try {
				await runAction(writePrompt, {
					busyLabel: '⏳ Writing...',
					failure:
						'❌ Failed to write the image prompt. Please check your text model settings.',
					onRestore: apply,
					work: async () => {
						apply();
						setPrompt(
							await writeImagePrompt(plan),
							'written',
							note.path,
						);
					},
				});
			} finally {
				progress.stop();
			}
		} catch (err) {
			reportError(err);
		}
	};

	// docs/design/03-note.md §3.2 — checks that don't need any model call and end in a
	// plain Notice; only the model + Anki write cycle the button through ⏳/✅/❌.
	const onAddImage = async () => {
		const note = getNote();
		if (addImage.el.disabled || addImage.busy || !note) return;
		try {
			const plan = await planAddImage(
				plugin,
				note,
				current.deck,
				current.model,
			);
			if (plan.stop !== undefined) {
				new Notice(plan.stop);
				return;
			}
			// A prompt already in the box is drawn as-is — no text model call.
			const given = prompt.trim();
			const progress = startProgressNotice(
				given
					? '⏳ Generating the image…'
					: '⏳ Asking the text model…',
			);
			let succeeded = false;
			try {
				await runAction(addImage, {
					busyLabel: '⏳ Generating...',
					failure:
						'❌ Failed to add image. Please check Anki connection.',
					onRestore: apply,
					work: async () => {
						apply();
						const outcome = await runAddImage(
							plugin,
							note,
							plan,
							given,
							(used) => {
								// Shown as soon as it exists, so it survives an image failure.
								if (!given) {
									setPrompt(used, 'written', note.path);
									progress.update('⏳ Generating the image…');
								}
							},
						);
						// Edited again while drawing → keep it marked as edited.
						if (prompt.trim() === outcome.prompt) {
							setPrompt(prompt, 'drawn', note.path);
						}
						succeeded = true;
					},
				});
			} finally {
				progress.stop();
			}
			if (succeeded) toastSuccess('🖼️ Image added to note');
		} catch (err) {
			reportError(err);
		}
	};

	const saveConfig = async (
		key: string,
		patch: Partial<ImageFieldConfig>,
	) => {
		const saved = plugin.settings.imageConfigs[key];
		plugin.settings.imageConfigs[key] = {
			outputField: saved?.outputField ?? '',
			onExisting: saved?.onExisting ?? 'append',
			...patch,
		};
		await plugin.saveSettings();
	};

	return {
		async sync(deck, model) {
			current = { deck, model };
			apply();
			if (prompt !== '' && getNote()?.path !== promptNote) {
				setPrompt('', 'written', '');
			}

			const key = fieldConfigKey(deck, model);
			if (key === renderedKey) return;
			renderedKey = key;
			configEl.empty();

			if (!deck || !model) {
				configEl.createEl('p', {
					cls: 'vocabweave-sidebar__hint',
					text: 'Set a deck and model above first.',
				});
				return;
			}

			const fields = await loadFields(plugin, model);
			if (!fields) return;
			// The note changed while fields were loading — a newer sync owns the tab.
			if (renderedKey !== key) return;

			const saved = plugin.settings.imageConfigs[key];
			new Setting(configEl)
				.setName('On existing tag')
				.addDropdown((dropdown) => {
					dropdown
						.addOptions({
							append: 'Append',
							overwrite: 'Overwrite',
						})
						.setValue(saved?.onExisting ?? 'append')
						.onChange(async (value) => {
							await saveConfig(key, {
								onExisting:
									value === 'overwrite'
										? 'overwrite'
										: 'append',
							});
						});
				});
			new Setting(configEl)
				.setName('Output field')
				.addDropdown((dropdown) => {
					const options: Record<string, string> = {
						'': 'Select a field',
					};
					for (const field of fields) options[field] = field;
					dropdown
						.addOptions(options)
						// A saved field the model no longer has shows as unselected.
						.setValue(
							saved && fields.includes(saved.outputField)
								? saved.outputField
								: '',
						)
						.onChange(async (value) => {
							await saveConfig(key, { outputField: value });
						});
				});
		},
	};
}
