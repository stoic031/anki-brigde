import type { TFile } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { examplesKey, fieldConfigKey, getActiveProfile } from '../settings';
import { parseSections } from '../sync/parser';
import type { TextContext, TextProvider } from '../providers/types';
import { runAiPreCheck } from './aiPreCheck';
import { fillEmptySections, resolveSectionKey } from './fillEmptySections';

export type GeneratePlan =
	| { stop: string } // user-facing reason nothing was attempted (not an error)
	| {
			stop?: undefined;
			provider: TextProvider;
			word: string;
			targetFields: string[];
			context: TextContext;
	  };

// docs/design/03-note.md §3.2 — everything that can be checked before spending a model call.
// Throws for real failures (AnkiConnect down, ProviderError building the provider).
export async function planGenerate(
	plugin: AnkiBridgePlugin,
	note: TFile,
	deck: string,
	model: string,
): Promise<GeneratePlan> {
	const check = runAiPreCheck('generate-ai', plugin.settings, deck, model);
	if (!check.configured) return { stop: check.message };

	const provider = plugin.providers.getTextProvider();
	if (!provider) return { stop: 'Set up a text model in settings first.' };

	// docs/design/03-note.md §3.2 — Main Field is Generate's input field, replacing
	// the old fields[0] convention. The note is already open, so its Main Field
	// dropdown is already visible in the sidebar for the user to set.
	const inputField =
		plugin.settings.mainFieldConfig[fieldConfigKey(deck, model)];
	if (!inputField) {
		return {
			stop: 'Please choose a main field for this deck/model in the sidebar first.',
		};
	}

	const sections = parseSections(await plugin.app.vault.read(note));
	const key = resolveSectionKey(sections.keys(), inputField);
	const value = key === undefined ? '' : sections.get(key);
	const word = (
		Array.isArray(value) ? value.join('\n') : (value ?? '')
	).trim();
	if (word === '')
		return { stop: `Please fill in the ${inputField} section first.` };

	const added =
		plugin.settings.generateWithAiFields[fieldConfigKey(deck, model)] ?? [];
	const targetFields = added.filter((f) => f !== inputField);
	if (targetFields.length === 0) {
		return {
			stop: `Add at least one field besides ${inputField} to generate.`,
		};
	}

	// docs/design/02-providers.md §2.4 — Learning language of the selected profile; the
	// note's Deck+Model don't pick a profile (profiles only drive note creation).
	// Unset → undefined, so buildMessages just leaves it out.
	const targetLanguage =
		getActiveProfile(plugin.settings).targetLanguage || undefined;
	const context: TextContext = {
		targetLanguage,
		nativeLanguage: plugin.settings.nativeLanguage || undefined,
		examples:
			plugin.settings.generateExamples[
				examplesKey(deck, model, targetLanguage)
			],
		instruction:
			plugin.settings.textInstructions[fieldConfigKey(deck, model)],
	};
	return { provider, word, targetFields, context };
}

export interface GenerateOutcome {
	filled: string[];
	skipped: string[];
}

// One model call — no write. The result is shown for review/editing (Text tab);
// nothing lands in the note until applyGenerated() below runs.
export async function generateDraft(
	plan: Exclude<GeneratePlan, { stop: string }>,
): Promise<Record<string, string>> {
	return plan.provider.processText(
		plan.word,
		'extract-vocabulary',
		plan.targetFields,
		plan.context,
	);
}

// One atomic write into the note from a (possibly user-edited) results map. Anki is
// never touched — the user syncs explicitly afterwards.
export async function applyGenerated(
	plugin: AnkiBridgePlugin,
	note: TFile,
	results: Record<string, string>,
): Promise<GenerateOutcome> {
	const outcome: GenerateOutcome = { filled: [], skipped: [] };
	await plugin.app.vault.process(note, (content) => {
		const r = fillEmptySections(content, results);
		outcome.filled = r.filled;
		outcome.skipped = r.skipped;
		return r.content;
	});
	return outcome;
}
