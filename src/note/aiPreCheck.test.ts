import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	fieldConfigKey,
	type AnkiBridgeSettings,
} from '../settings';
import { runAiPreCheck } from './aiPreCheck';

function fakeSettings(
	overrides: Partial<AnkiBridgeSettings> = {},
): AnkiBridgeSettings {
	return {
		ankiConnectUrl: '',
		profiles: DEFAULT_SETTINGS.profiles,
		activeProfileId: DEFAULT_SETTINGS.activeProfileId,
		generateWithAiFields: {},
		...overrides,
	};
}

describe('runAiPreCheck — generate-ai', () => {
	it('is not configured when no field checkbox has been ticked for this pair', () => {
		const result = runAiPreCheck(
			'generate-ai',
			fakeSettings(),
			'Japanese',
			'Basic',
		);

		expect(result).toEqual({
			configured: false,
			message:
				'Please configure AI field generation for this Deck/Model in the sidebar (Tab 1) first.',
		});
	});

	it('is not configured when the saved list for this pair is empty', () => {
		const key = fieldConfigKey('Japanese', 'Basic');
		const settings = fakeSettings({ generateWithAiFields: { [key]: [] } });

		expect(runAiPreCheck('generate-ai', settings, 'Japanese', 'Basic')).toEqual({
			configured: false,
			message:
				'Please configure AI field generation for this Deck/Model in the sidebar (Tab 1) first.',
		});
	});

	it('is configured when at least one field is ticked for this pair', () => {
		const key = fieldConfigKey('Japanese', 'Basic');
		const settings = fakeSettings({
			generateWithAiFields: { [key]: ['Meaning'] },
		});

		expect(runAiPreCheck('generate-ai', settings, 'Japanese', 'Basic')).toEqual({
			configured: true,
		});
	});

	it('does not leak configuration from a different Deck+Model pair', () => {
		const otherKey = fieldConfigKey('Spanish', 'Cloze');
		const settings = fakeSettings({
			generateWithAiFields: { [otherKey]: ['Meaning'] },
		});

		expect(
			runAiPreCheck('generate-ai', settings, 'Japanese', 'Basic'),
		).toEqual({
			configured: false,
			message:
				'Please configure AI field generation for this Deck/Model in the sidebar (Tab 1) first.',
		});
	});
});

describe('runAiPreCheck — add-audio', () => {
	it('is always not configured — Tab 2 does not exist yet', () => {
		expect(
			runAiPreCheck('add-audio', fakeSettings(), 'Japanese', 'Basic'),
		).toEqual({
			configured: false,
			message:
				'Please configure Audio field mapping for this Deck/Model in the sidebar (Tab 2) first.',
		});
	});
});

describe('runAiPreCheck — add-image', () => {
	it('is always not configured — Tab 3 does not exist yet', () => {
		expect(
			runAiPreCheck('add-image', fakeSettings(), 'Japanese', 'Basic'),
		).toEqual({
			configured: false,
			message:
				'Please configure Image field mapping for this Deck/Model in the sidebar (Tab 3) first.',
		});
	});
});
