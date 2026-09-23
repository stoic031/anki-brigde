import type { TFile } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { fieldConfigKey, resolveAnkiConnectUrl } from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { parseSections } from '../sync/parser';
import type { TextProvider } from '../providers/types';
import { runAiPreCheck } from './aiPreCheck';
import { fillEmptySections, resolveSectionKey } from './fillEmptySections';

export type GeneratePlan =
	| { stop: string } // user-facing reason nothing was attempted (not an error)
	| {
			stop?: undefined;
			provider: TextProvider;
			word: string;
			targetFields: string[];
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

	const client = new AnkiConnectClient(
		resolveAnkiConnectUrl(plugin.settings),
	);
	const fields = await client.modelFieldNames(model);
	const inputField = fields[0];
	if (!inputField) return { stop: 'This model has no fields.' };

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
	return { provider, word, targetFields };
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
