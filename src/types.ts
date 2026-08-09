// §1 Frontmatter
export interface AnkiFrontmatter {
	anki_note_id?: number; // absent = never synced
	anki_deck: string; // "Japanese::N2"
	anki_model: string; // "Basic (and reversed card)"
	last_synced?: string; // ISO 8601 UTC
	tags?: string[];
}

// §2 Parsed note
export interface ParsedNote {
	frontmatter: AnkiFrontmatter;
	sections: Map<string, string>; // key = normalized heading (lowercased, trimmed)
	raw: string;
}

// §4 AI providers
export interface TextResult {
	[fieldName: string]: string; // keyed by exact Anki field name from targetFields
}

export interface MediaResult {
	base64: string; // raw base64, NO "data:...;base64," prefix
	ext: string; // "mp3" | "png" — no leading dot
	mimeType: string;
}

export interface TextProvider {
	id: string;
	isCloud: boolean;
	processText(
		input: string,
		task: TextTask,
		targetFields: string[], // fields the user ticked in the Generate-with-AI modal
	): Promise<TextResult>;
}

export interface AudioProvider {
	id: string;
	isCloud: boolean;
	generateAudio(text: string, opts: AudioOptions): Promise<MediaResult>;
}

export interface ImageProvider {
	id: string;
	isCloud: boolean;
	generateImage(prompt: string, opts: ImageOptions): Promise<MediaResult>;
}

export type TextTask = 'extract-vocabulary' | 'generate-example' | 'rewrite';

export interface AudioOptions {
	voice: string; // Sidebar Modal Tab 2, e.g. "Male" | "Female" — docs/design/07-sidebar.md §7.2.2
	language: string; // Sidebar Modal Tab 2, provider-dependent list — docs/design/07-sidebar.md §7.2.2
	speed?: number; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
}

export interface ImageOptions {
	size?: string; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
	steps?: number; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
	negativePrompt?: string; // Settings Tab Image provider config — docs/design/06-settings.md §6.2
}

// §6 Errors
export class AnkiConnectError extends Error {
	constructor(
		public action: string,
		public ankiMessage: string,
	) {
		super(`AnkiConnect '${action}' failed: ${ankiMessage}`);
	}
}

export class ProviderError extends Error {
	constructor(
		public providerId: string,
		public cause: string,
	) {
		super(`${providerId}: ${cause}`);
	}
}
