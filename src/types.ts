// §1 Frontmatter
export interface AnkiFrontmatter {
	anki_note_id?: number; // absent = never synced
	anki_deck: string; // "Japanese::N2"
	anki_model: string; // "Basic (and reversed card)"
	last_synced?: string; // ISO 8601 UTC
	tags?: string[];
}

// §2 Parsed note
export type SectionValue = string | string[]; // list sections (lines starting with '-') are string[]; everything else is string

export interface ParsedNote {
	frontmatter: AnkiFrontmatter;
	sections: Map<string, SectionValue>; // key = normalized heading (lowercased, trimmed)
	raw: string;
}

// §3 Field mapping
export interface FieldMappingResult {
	fields: Record<string, string>;
	warnings: string[];
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

export class SyncError extends Error {
	constructor(
		public reason: 'offline' | 'duplicate' | 'parse-error' | 'model-not-found',
		message: string,
	) {
		super(message);
	}
}
