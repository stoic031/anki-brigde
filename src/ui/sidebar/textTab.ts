import { Notice, Setting, type TFile } from 'obsidian';
import type AnkiBridgePlugin from '../../main';
import { planGenerate, runGenerate } from '../../note/generateFields';
import { fieldConfigKey, resolveAnkiConnectUrl } from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { ProviderError } from '../../types';
import { toastError, toastSuccess } from '../toast';
import { createActionButton, runAction } from './actionButton';

export interface TextTab {
	// Called whenever the active note's Deck+Model may have changed. Only re-fetches the
	// field list when the pair actually differs from what is rendered.
	sync(deck: string, model: string): Promise<void>;
}

// docs/design/07-sidebar.md §7.2.1 — Text tab: which fields "Generate with AI" fills,
// with the Generate button next to the section title.
function reportOutcome({
	filled,
	skipped,
}: {
	filled: string[];
	skipped: string[];
}): void {
	if (filled.length === 0 && skipped.length === 0) {
		new Notice(
			'The text model returned nothing to add. Try again or check the model.',
		);
		return;
	}
	const skippedNote =
		skipped.length > 0
			? `, ${skipped.length} skipped (already had content)`
			: '';
	toastSuccess(
		`✅ AI content generated: ${filled.length} filled${skippedNote}.`,
	);
}

export function renderTextTab(
	parent: HTMLElement,
	plugin: AnkiBridgePlugin,
	getNote: () => TFile | null,
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

	// docs/design/03-note.md §3.2 — checks that don't need the model run first and end in a
	// plain Notice; only the model call + write cycle the button through ⏳/✅/❌.
	generate.el.addEventListener('click', () => {
		void onGenerate();
	});

	const onGenerate = async () => {
		const note = getNote();
		if (generate.el.disabled || generate.busy || !note) return;
		try {
			const plan = await planGenerate(
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
			let outcome = { filled: [] as string[], skipped: [] as string[] };
			try {
				await runAction(generate, {
					busyLabel: '⏳ Generating...',
					failure:
						'❌ Failed to generate content. Please check your text model settings.',
					onRestore: () => {
						generate.el.disabled = !current.deck || !current.model;
					},
					work: async () => {
						outcome = await runGenerate(plugin, note, plan);
					},
				});
			} finally {
				progress.hide();
			}
			reportOutcome(outcome);
		} catch (err) {
			toastError(
				err instanceof ProviderError
					? `❌ ${err.message}`
					: '❌ Failed to generate content. Please check Anki connection.',
			);
		}
	};

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
			if (!generate.busy) generate.el.disabled = !deck || !model;

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
