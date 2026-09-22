export interface TextResult {
	[fieldName: string]: string; // keyed by exact Anki field name from targetFields
}

export interface MediaResult {
	base64: string; // raw base64, NO "data:...;base64," prefix
	ext: string; // e.g. "png" — no leading dot
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

export interface ImageProvider {
	id: string;
	isCloud: boolean;
	generateImage(prompt: string, opts: ImageOptions): Promise<MediaResult>;
}

export type TextTask =
	| 'extract-vocabulary'
	| 'generate-example'
	| 'rewrite'
	| 'build-image-prompt'; // input = the card's fields, result = the prompt for ImageProvider

export interface ImageOptions {
	size?: string; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
	steps?: number; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
	negativePrompt?: string; // Settings Tab Image provider config — docs/design/06-settings.md §6.2
}
