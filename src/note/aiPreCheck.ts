import { fieldConfigKey, type AnkiBridgeSettings } from '../settings';

export type AiButtonAction = 'generate-ai' | 'add-audio' | 'add-image';

export type AiPreCheckResult =
	| { configured: true }
	| { configured: false; message: string };

// docs/design/03-note.md §3.2 — shared pre-check for all 3 AI buttons (Generate with
// AI, Add Audio, Add Image): each reads the saved config for the note's Deck+Model pair
// before doing anything, and stops with this Notice if it's unconfigured.
export function runAiPreCheck(
	action: AiButtonAction,
	settings: AnkiBridgeSettings,
	deck: string,
	model: string,
): AiPreCheckResult {
	switch (action) {
		case 'generate-ai': {
			const fields = settings.generateWithAiFields[fieldConfigKey(deck, model)];
			if (fields && fields.length > 0) return { configured: true };
			return {
				configured: false,
				message:
					'Please configure AI field generation for this Deck/Model in the sidebar (Tab 1) first.',
			};
		}
		// Tab 2/Tab 3 have no settings shape yet — Features #40/#41 (Sidebar Tab 2/3)
		// haven't been built, so every Deck+Model pair is genuinely unconfigured for
		// these two actions. See docs/design-open-questions.md #18.
		case 'add-audio':
			return {
				configured: false,
				message:
					'Please configure Audio field mapping for this Deck/Model in the sidebar (Tab 2) first.',
			};
		case 'add-image':
			return {
				configured: false,
				message:
					'Please configure Image field mapping for this Deck/Model in the sidebar (Tab 3) first.',
			};
	}
}
