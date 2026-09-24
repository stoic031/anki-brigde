import { fieldConfigKey, type VocabWeaveSettings } from '../settings';

export type AiButtonAction = 'generate-ai' | 'add-image';

export type AiPreCheckResult =
	{ configured: true } | { configured: false; message: string };

// docs/design/03-note.md §3.2 — shared pre-check for both AI buttons (Generate with
// AI, Add Image): each reads the saved config for the note's Deck+Model pair
// before doing anything, and stops with this Notice if it's unconfigured.
export function runAiPreCheck(
	action: AiButtonAction,
	settings: VocabWeaveSettings,
	deck: string,
	model: string,
): AiPreCheckResult {
	switch (action) {
		case 'generate-ai': {
			const fields =
				settings.generateWithAiFields[fieldConfigKey(deck, model)];
			if (fields && fields.length > 0) return { configured: true };
			return {
				configured: false,
				message:
					'Please configure AI field generation for this Deck/Model in the sidebar (Text tab) first.',
			};
		}
		case 'add-image': {
			const config = settings.imageConfigs[fieldConfigKey(deck, model)];
			if (config && config.outputField !== '')
				return { configured: true };
			return {
				configured: false,
				message:
					'Please configure Image field mapping for this Deck/Model in the sidebar (Image tab) first.',
			};
		}
	}
}
