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

	const ticked =
		plugin.settings.generateWithAiFields[fieldConfigKey(deck, model)] ?? [];
	const targetFields = ticked.filter((f) => f !== inputField);
	if (targetFields.length === 0) {
		return {
			stop: `Tick at least one field besides ${inputField} to generate.`,
		};
	}
	return { provider, word, targetFields };
}

export interface GenerateOutcome {
	filled: string[];
	skipped: string[];
}

// One model call, then one atomic write into the note. Anki is never touched — the user
// syncs explicitly afterwards.
export async function runGenerate(
	plugin: AnkiBridgePlugin,
	note: TFile,
	plan: Exclude<GeneratePlan, { stop: string }>,
): Promise<GenerateOutcome> {
	const results = await plan.provider.processText(
		plan.word,
		'extract-vocabulary',
		plan.targetFields,
	);
	const outcome: GenerateOutcome = { filled: [], skipped: [] };
	await plugin.app.vault.process(note, (content) => {
		const r = fillEmptySections(content, results);
		outcome.filled = r.filled;
		outcome.skipped = r.skipped;
		return r.content;
	});
	return outcome;
}
