import { Notice, Setting } from 'obsidian';
import type AnkiBridgePlugin from '../../main';
import { runAiPreCheck } from '../../note/aiPreCheck';
import { fieldConfigKey, resolveAnkiConnectUrl } from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { toastError } from '../toast';
import { createActionButton } from './actionButton';

export interface TextTab {
	// Called whenever the active note's Deck+Model may have changed. Only re-fetches the
	// field list when the pair actually differs from what is rendered.
	sync(deck: string, model: string): Promise<void>;
}

// docs/design/07-sidebar.md §7.2.1 — Text tab: which fields "Generate with AI" fills,
// with the Generate button next to the section title.
export function renderTextTab(
	parent: HTMLElement,
	plugin: AnkiBridgePlugin,
): TextTab {
	const header = parent.createDiv({ cls: 'anki-bridge-sidebar__section-header' });
	header.createSpan({
		cls: 'anki-bridge-sidebar__section-title',
		text: 'Fields to generate with AI',
	});
	const generate = createActionButton(header, {
		icon: 'sparkles',
		label: 'Generate',
		variant: 'primary',
	});
	generate.el.disabled = true;
	const fieldsEl = parent.createDiv({
		cls: 'anki-bridge-sidebar__field-checkboxes',
	});

	let current = { deck: '', model: '' };
	let renderedKey = '';

	generate.el.addEventListener('click', () => {
		if (generate.el.disabled) return;
		// docs/design/03-note.md §3.2 — AI generation itself isn't implemented yet; the
		// button only runs the shared pre-check.
		const result = runAiPreCheck(
			'generate-ai',
			plugin.settings,
			current.deck,
			current.model,
		);
		new Notice(
			result.configured
				? 'Generate with AI is not available yet.'
				: result.message,
		);
	});

	const setFieldSelected = async (
		deck: string,
		model: string,
		field: string,
		selected: boolean,
	) => {
		const key = fieldConfigKey(deck, model);
		const set = new Set(plugin.settings.generateWithAiFields[key]);
		if (selected) set.add(field);
		else set.delete(field);
		plugin.settings.generateWithAiFields[key] = [...set];
		await plugin.saveSettings();
	};

	return {
		async sync(deck, model) {
			current = { deck, model };
			generate.el.disabled = !deck || !model;

			const key = fieldConfigKey(deck, model);
			if (key === renderedKey) return;
			renderedKey = key;
			fieldsEl.empty();

			if (!deck || !model) {
				fieldsEl.createEl('p', {
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
				toastError('❌ Failed to load fields. Please check Anki connection.');
				return;
			}
			// The note changed while fields were loading — a newer sync owns the list.
			if (renderedKey !== key) return;

			const selected = new Set(plugin.settings.generateWithAiFields[key]);
			for (const field of fields) {
				new Setting(fieldsEl).setName(field).addToggle((toggle) => {
					toggle.setValue(selected.has(field));
					toggle.onChange(async (value) => {
						await setFieldSelected(deck, model, field, value);
					});
				});
			}
		},
	};
}
