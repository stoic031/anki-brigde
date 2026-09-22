import { Notice, Setting, type TFile } from 'obsidian';
import type AnkiBridgePlugin from '../../main';
import { planAddImage, runAddImage } from '../../note/addImage';
import {
	fieldConfigKey,
	resolveAnkiConnectUrl,
	type ImageFieldConfig,
} from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { ProviderError } from '../../types';
import { toastError } from '../toast';
import { createActionButton, runAction } from './actionButton';

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
	plugin: AnkiBridgePlugin,
	getNote: () => TFile | null,
): ImageTab {
	const header = parent.createDiv({
		cls: 'anki-bridge-sidebar__section-header',
	});
	header.createSpan({
		cls: 'anki-bridge-sidebar__section-title',
		text: 'Image field mapping',
	});
	const addImage = createActionButton(header, {
		icon: 'image',
		label: 'Add image',
		variant: 'primary',
	});
	addImage.el.disabled = true;
	const configEl = parent.createDiv({
		cls: 'anki-bridge-sidebar__image-config',
	});

	let current = { deck: '', model: '' };
	let renderedKey = '';

	addImage.el.addEventListener('click', () => {
		void onAddImage();
	});

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
			const progress = new Notice('⏳ Asking the text model…', 0);
			try {
				await runAction(addImage, {
					busyLabel: '⏳ Generating...',
					failure:
						'❌ Failed to add image. Please check Anki connection.',
					onRestore: () => {
						addImage.el.disabled = !current.deck || !current.model;
					},
					work: async () => {
						await runAddImage(plugin, note, plan, () =>
							progress.setMessage('⏳ Generating the image…'),
						);
					},
				});
			} finally {
				progress.hide();
			}
		} catch (err) {
			toastError(
				err instanceof ProviderError
					? `❌ ${err.message}`
					: '❌ Failed to add image. Please check Anki connection.',
			);
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
			if (!addImage.busy) addImage.el.disabled = !deck || !model;

			const key = fieldConfigKey(deck, model);
			if (key === renderedKey) return;
			renderedKey = key;
			configEl.empty();

			if (!deck || !model) {
				configEl.createEl('p', {
					cls: 'anki-bridge-sidebar__hint',
					text: 'Set a Deck and Model on the Note tab first.',
				});
				return;
			}

			let fields: string[];
			try {
				const client = new AnkiConnectClient(
					resolveAnkiConnectUrl(plugin.settings),
				);
				fields = await client.modelFieldNames(model);
			} catch {
				toastError(
					'❌ Failed to load fields. Please check Anki connection.',
				);
				return;
			}
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
