import { Menu, Notice, Setting, type TFile } from 'obsidian';
import type AnkiBridgePlugin from '../../main';
import {
	applyGenerated,
	generateDraft,
	planGenerate,
} from '../../note/generateFields';
import {
	examplesKey,
	fieldConfigKey,
	rememberExample,
	resolveAnkiConnectUrl,
} from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { AnkiConnectError, ProviderError } from '../../types';
import { toastError, toastSuccess } from '../toast';
import { createActionButton, runAction } from './actionButton';
import { startProgressNotice } from './progressNotice';
import { renderPromptBox } from './promptBox';

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
	const actionsRow = parent.createDiv({
		cls: 'anki-bridge-sidebar__actions',
	});
	const generate = createActionButton(actionsRow, {
		icon: 'sparkles',
		label: 'Generate',
		variant: 'primary',
	});
	const write = createActionButton(actionsRow, {
		icon: 'save',
		label: 'Write',
		variant: 'primary',
	});
	const addField = createActionButton(actionsRow, {
		icon: 'plus',
		label: 'Add field',
	});
	const clear = createActionButton(actionsRow, {
		icon: 'eraser',
		label: 'Clear',
	});
	generate.el.disabled = true;
	write.el.disabled = true;
	addField.el.disabled = true;
	clear.el.disabled = true;

	parent.createDiv({
		cls: [
			'anki-bridge-sidebar__section-title',
			'anki-bridge-sidebar__section-title--block',
		],
		text: 'Fields to generate with AI',
	});
	const fieldsEl = parent.createDiv({
		cls: 'anki-bridge-sidebar__field-checkboxes',
	});
	const promptBox = renderPromptBox(parent, plugin);

	let current = { deck: '', model: '' };
	let renderedKey = '';
	let allFields: string[] = [];
	let inputField = '';
	let addedFields: string[] = [];
	// In-memory only — never persisted, cleared on a pair change and after a
	// successful Write. Keyed by field name; a field's entry only exists once
	// Generate has run at least once since it was added.
	let drafts: Record<string, string> = {};
	// The Main Field value and Learning language the drafts were generated with —
	// recorded with them on Write.
	let draftWord = '';
	let draftLanguage = '';

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
		clear.el.disabled = Object.keys(drafts).length === 0;
		promptBox.render(current.deck, current.model, addedFields.length);
		if (!current.deck || !current.model) return;

		const remaining = allFields.filter(
			(f) => f !== inputField && !addedFields.includes(f),
		);
		addField.el.disabled = remaining.length === 0;

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

	// Drops every preview without touching the note — they are in-memory only and
	// Generate can recreate them.
	clear.el.addEventListener('click', () => {
		if (clear.el.disabled) return;
		drafts = {};
		draftWord = '';
		renderFields();
	});

	// docs/design/07-sidebar.md §7.2.1 — opens a Menu of the fields not yet added
	// (same list the old dropdown offered), instead of a <select>, so this button can
	// look like Generate/Write.
	addField.el.addEventListener('click', (evt) => {
		if (addField.el.disabled) return;
		const remaining = allFields.filter(
			(f) => f !== inputField && !addedFields.includes(f),
		);
		const menu = new Menu();
		for (const field of remaining) {
			menu.addItem((item) =>
				item.setTitle(field).onClick(async () => {
					addedFields.push(field);
					await persist();
					renderFields();
				}),
			);
		}
		menu.showAtMouseEvent(evt);
	});

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
						draftWord = plan.word;
						draftLanguage = plan.context.targetLanguage ?? '';
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
			// AnkiConnectError reaches here bare for a real, unrecognized AnkiConnect
			// error (planGenerate's modelFieldNames call) — show its own message rather
			// than the generic fallback, which would misreport it as a connection issue.
			toastError(
				err instanceof ProviderError || err instanceof AnkiConnectError
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
				// docs/design/02-providers.md §2.4 — what the user wrote (edits included)
				// becomes a few-shot example for the next Generate on this pair.
				const fields = Object.fromEntries(
					Object.entries(drafts).filter(([, v]) => v.trim() !== ''),
				);
				if (draftWord) {
					rememberExample(
						plugin.settings,
						examplesKey(current.deck, current.model, draftLanguage),
						{ word: draftWord, fields },
					);
					await plugin.saveSettings();
				}
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
			promptBox.render('', '', 0);
			addField.el.disabled = true;
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
