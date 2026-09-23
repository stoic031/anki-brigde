import { Notice, Setting, type TFile } from 'obsidian';
import type AnkiBridgePlugin from '../../main';
import {
	applyGenerated,
	generateDraft,
	planGenerate,
} from '../../note/generateFields';
import { fieldConfigKey, resolveAnkiConnectUrl } from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { ProviderError } from '../../types';
import { toastError, toastSuccess } from '../toast';
import { createActionButton, runAction } from './actionButton';
import { startProgressNotice } from './progressNotice';

export interface TextTab {
	// Called whenever the active note's Deck+Model may have changed. Only re-fetches the
	// field list when the pair actually differs from what is rendered.
	sync(deck: string, model: string): Promise<void>;
	// Called when Main Field changes for the current pair (sidebarView's Main Field
	// dropdown). Re-reads it and re-renders even though the pair itself didn't change —
	// sync() alone would no-op via its renderedKey dedup.
	refresh(deck: string, model: string): Promise<void>;
}

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

// docs/design/07-sidebar.md §7.2.1 — Text tab: build a list of fields to generate with
// AI (a dropdown adds one at a time, from the same modelFieldNames source as before),
// Generate fills an editable preview per field, Write commits the (possibly edited)
// text into the note. Nothing reaches the note until Write — Generate alone never
// touches vault content.
export function renderTextTab(
	parent: HTMLElement,
	plugin: AnkiBridgePlugin,
	getNote: () => TFile | null,
): TextTab {
	const header = parent.createDiv({
		cls: 'anki-bridge-sidebar__section-header',
	});
	header.createSpan({
		cls: 'anki-bridge-sidebar__section-title',
		text: 'Fields to generate with AI',
	});
	const generate = createActionButton(header, {
		icon: 'sparkles',
		label: 'Generate',
		variant: 'primary',
	});
	const write = createActionButton(header, {
		icon: 'save',
		label: 'Write',
		variant: 'primary',
	});
	generate.el.disabled = true;
	write.el.disabled = true;
	const addFieldEl = parent.createDiv();
	const fieldsEl = parent.createDiv({
		cls: 'anki-bridge-sidebar__field-checkboxes',
	});

	let current = { deck: '', model: '' };
	let renderedKey = '';
	let allFields: string[] = [];
	let inputField = '';
	let addedFields: string[] = [];
	// In-memory only — never persisted, cleared on a pair change and after a
	// successful Write. Keyed by field name; a field's entry only exists once
	// Generate has run at least once since it was added.
	let drafts: Record<string, string> = {};

	const apply = () => {
		if (!generate.busy)
			generate.el.disabled = !current.deck || !current.model;
		if (!write.busy) write.el.disabled = !current.deck || !current.model;
	};

	const persist = async () => {
		const key = fieldConfigKey(current.deck, current.model);
		plugin.settings.generateWithAiFields[key] = [...addedFields];
		await plugin.saveSettings();
	};

	const renderFields = (): void => {
		fieldsEl.empty();
		addFieldEl.empty();
		if (!current.deck || !current.model) return;

		const remaining = allFields.filter(
			(f) => f !== inputField && !addedFields.includes(f),
		);
		new Setting(addFieldEl).addDropdown((dropdown) => {
			dropdown.addOption('', '+ add field');
			for (const field of remaining) dropdown.addOption(field, field);
			dropdown.setValue('');
			dropdown.setDisabled(remaining.length === 0);
			dropdown.onChange(async (value) => {
				if (value === '') return;
				addedFields.push(value);
				await persist();
				renderFields();
			});
		});

		for (const field of addedFields) {
			const row = new Setting(fieldsEl)
				.setName(field)
				.addExtraButton((button) =>
					button
						.setIcon('x')
						.setTooltip('Remove')
						.onClick(async () => {
							addedFields = addedFields.filter(
								(f) => f !== field,
							);
							delete drafts[field];
							await persist();
							renderFields();
						}),
				);
			// The textarea only appears once Generate has produced a draft for this
			// field — before that there's nothing to show or edit yet.
			if (field in drafts) {
				row.addTextArea((area) => {
					area.setValue(drafts[field] ?? '');
					area.inputEl.addEventListener('change', () => {
						drafts[field] = area.getValue();
					});
				});
			}
		}
	};

	// docs/design/03-note.md §3.2 — checks that don't need the model run first and end in a
	// plain Notice; only the model call cycles the button through ⏳/✅/❌.
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
			const progress = startProgressNotice('⏳ Asking the text model…');
			try {
				await runAction(generate, {
					busyLabel: '⏳ Generating...',
					failure:
						'❌ Failed to generate content. Please check your text model settings.',
					onRestore: apply,
					work: async () => {
						const results = await generateDraft(plan);
						// Full regenerate: every currently-added field's preview is replaced,
						// same as the single batch model call it always was.
						let any = false;
						for (const field of addedFields) {
							drafts[field] = results[field] ?? '';
							if (drafts[field] !== '') any = true;
						}
						renderFields();
						if (!any) {
							new Notice(
								'The text model returned nothing to add. Try again or check the model.',
							);
						}
					},
				});
			} finally {
				progress.stop();
			}
		} catch (err) {
			toastError(
				err instanceof ProviderError
					? `❌ ${err.message}`
					: '❌ Failed to generate content. Please check Anki connection.',
			);
		}
	};

	write.el.addEventListener('click', () => {
		void onWrite();
	});

	const onWrite = async () => {
		const note = getNote();
		if (write.el.disabled || write.busy || !note) return;
		if (!Object.values(drafts).some((v) => v.trim() !== '')) {
			new Notice('Generate content first.');
			return;
		}
		await runAction(write, {
			busyLabel: '⏳ Writing...',
			failure: '❌ Failed to write to the note.',
			onRestore: apply,
			work: async () => {
				const outcome = await applyGenerated(plugin, note, drafts);
				reportOutcome(outcome);
				drafts = {};
				renderFields();
			},
		});
	};

	// force = true (refresh()) bypasses the renderedKey dedup — used when Main Field
	// changes for the same pair, which sync() alone wouldn't pick up.
	const doSync = async (deck: string, model: string, force: boolean) => {
		current = { deck, model };
		apply();

		const key = fieldConfigKey(deck, model);
		if (!force && key === renderedKey) return;
		renderedKey = key;

		if (!deck || !model) {
			allFields = [];
			inputField = '';
			addedFields = [];
			drafts = {};
			fieldsEl.empty();
			addFieldEl.empty();
			fieldsEl.createEl('p', {
				cls: 'anki-bridge-sidebar__hint',
				text: 'Set a Deck and Model above first.',
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
		// The note changed while fields were loading — a newer sync owns the list.
		if (renderedKey !== key) return;

		allFields = fields;
		inputField = plugin.settings.mainFieldConfig?.[key] ?? '';
		const saved = plugin.settings.generateWithAiFields[key] ?? [];
		addedFields = saved.filter(
			(f) => f !== inputField && allFields.includes(f),
		);
		drafts = {};
		renderFields();
	};

	return {
		sync: (deck, model) => doSync(deck, model, false),
		refresh: (deck, model) => doSync(deck, model, true),
	};
}
