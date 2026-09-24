import type { TFile } from 'obsidian';
import type VocabWeavePlugin from '../main';
import {
	fieldConfigKey,
	resolveAnkiConnectUrl,
	resolveMediaPrefix,
} from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { parseSections } from '../sync/parser';
import type { ImageProvider, TextProvider } from '../providers/types';
import { IMAGE_PROMPT_KEY } from '../providers/text/prompt';
import { ProviderError, type SectionValue } from '../types';
import { runAiPreCheck } from './aiPreCheck';
import { applyImageTag, type ImageTagMode } from './applyImageTag';
import { buildMediaFilename } from './mediaNaming';
import { resolveSectionKey } from './fillEmptySections';

export type AddImagePlan =
	| { stop: string } // user-facing reason nothing was attempted (not an error)
	| {
			stop?: undefined;
			textProvider: TextProvider;
			imageProvider: ImageProvider;
			fieldsInput: string; // "FieldName: value" lines, one per non-empty field except Output
			word: string; // fields[0]'s section value — used for the media filename
			outputField: string;
			onExisting: ImageTagMode;
	  };

function sectionText(
	sections: Map<string, SectionValue>,
	field: string,
): string {
	const key = resolveSectionKey(sections.keys(), field);
	const value = key === undefined ? '' : sections.get(key);
	return (Array.isArray(value) ? value.join('\n') : (value ?? '')).trim();
}

// docs/design/03-note.md §3.2 — everything that can be checked before spending a model
// call. Throws for real failures (AnkiConnect down, ProviderError building a provider).
export async function planAddImage(
	plugin: VocabWeavePlugin,
	note: TFile,
	deck: string,
	model: string,
): Promise<AddImagePlan> {
	const check = runAiPreCheck('add-image', plugin.settings, deck, model);
	if (!check.configured) return { stop: check.message };

	const textProvider = plugin.providers.getTextProvider();
	if (!textProvider) {
		return {
			stop: 'Set up a text model in settings to generate image prompts.',
		};
	}
	const imageProvider = plugin.providers.getImageProvider();
	if (!imageProvider)
		return { stop: 'Set up an image model in settings first.' };

	const config = plugin.settings.imageConfigs[fieldConfigKey(deck, model)];
	// runAiPreCheck already guarantees outputField is non-empty for this pair.
	const outputField = config?.outputField ?? '';
	const onExisting = config?.onExisting ?? 'append';

	const client = new AnkiConnectClient(
		resolveAnkiConnectUrl(plugin.settings),
	);
	const fields = await client.modelFieldNames(model);
	const sections = parseSections(await plugin.app.vault.read(note));

	// Main Field first — the instruction treats the first line as the item to learn
	// (a word or a spoken phrase), whatever the Anki model's field order.
	const mainField =
		plugin.settings.mainFieldConfig[fieldConfigKey(deck, model)] ?? '';
	const ordered = fields.includes(mainField)
		? [mainField, ...fields.filter((f) => f !== mainField)]
		: fields;
	const fieldLines = ordered
		.filter((field) => field !== outputField)
		.map((field) => ({ field, text: sectionText(sections, field) }))
		.filter(({ text }) => text !== '')
		.map(({ field, text }) => `${field}: ${text}`);
	if (fieldLines.length === 0) {
		return {
			stop: 'Nothing to generate an image from — please fill in at least one field first.',
		};
	}

	const word = fields[0] ? sectionText(sections, fields[0]) : '';

	return {
		textProvider,
		imageProvider,
		fieldsInput: fieldLines.join('\n'),
		word,
		outputField,
		onExisting,
	};
}

export interface AddImageOutcome {
	filename: string;
	prompt: string; // what the image model actually drew
}

// Text models vary: some answer with newlines, a "Prompt:" label or wrapping quotes.
// Only for the model's answer — a prompt the user typed is drawn as-is.
export function cleanImagePrompt(raw: string): string {
	const flat = raw
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^prompt\s*:\s*/i, '');
	const m = /^(["'`])(.*)\1$/.exec(flat);
	return (m ? (m[2] ?? '') : flat).trim();
}

// The text model turns the card's fields into one English image prompt. Shown in the
// Image tab for the user to edit before (or after) drawing — docs/design/07-sidebar.md §7.2.2.
export async function writeImagePrompt(
	plan: Exclude<AddImagePlan, { stop: string }>,
): Promise<string> {
	const result = await plan.textProvider.processText(
		plan.fieldsInput,
		'build-image-prompt',
		[],
	);
	const prompt = cleanImagePrompt(result[IMAGE_PROMPT_KEY] ?? '');
	if (prompt === '') {
		throw new ProviderError(
			plan.textProvider.id,
			'returned no image prompt',
		);
	}
	return prompt;
}

// Image model draws the prompt (the text model writes one first only when none is
// given), AnkiConnect stores the file, then one atomic write into the note. Anki's card
// fields are never touched — the user syncs explicitly afterwards.
export async function runAddImage(
	plugin: VocabWeavePlugin,
	note: TFile,
	plan: Exclude<AddImagePlan, { stop: string }>,
	givenPrompt: string,
	// .claude/rules/ui-copy.md — long operations need a Notice that updates as work
	// progresses; this fires once the prompt is ready, right before the image call.
	onPromptBuilt?: (prompt: string) => void,
): Promise<AddImageOutcome> {
	const prompt = givenPrompt.trim() || (await writeImagePrompt(plan));
	onPromptBuilt?.(prompt);

	// negativePrompt already flows into the image provider's own config
	// (getActiveImageConfig, settings.ts) — nothing to pass here.
	const media = await plan.imageProvider.generateImage(prompt, {});
	const filename = buildMediaFilename(
		plan.word,
		media.ext,
		resolveMediaPrefix(plugin.settings),
	);

	const client = new AnkiConnectClient(
		resolveAnkiConnectUrl(plugin.settings),
	);
	const stored = await client.storeMediaFile(filename, media.base64);

	await plugin.app.vault.process(note, (content) =>
		applyImageTag(
			content,
			plan.outputField,
			`<img src="${stored}">`,
			plan.onExisting,
		),
	);
	return { filename: stored, prompt };
}
