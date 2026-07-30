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
	word: string;
	meaning: string;
	furigana?: string;
	partOfSpeech?: string;
	collocations?: string[];
	exampleSentences?: string[];
}

export interface MediaResult {
	base64: string; // raw base64, NO "data:...;base64," prefix
	ext: string; // "mp3" | "png" — no leading dot
	mimeType: string;
}

export interface TextProvider {
	id: string;
	isCloud: boolean;
	processText(input: string, task: TextTask): Promise<TextResult>;
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

// AudioOptions / ImageOptions are referenced by §4 but not yet defined anywhere in
// docs/contracts.md or docs/design/ — see docs/design-open-questions.md.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- placeholder until shape is specified, see docs/design-open-questions.md #14
export interface AudioOptions {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- placeholder until shape is specified, see docs/design-open-questions.md #14
export interface ImageOptions {}

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
