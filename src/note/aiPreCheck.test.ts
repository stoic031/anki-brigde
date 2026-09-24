import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	fieldConfigKey,
	type AnkiBridgeSettings,
} from '../settings';
import { DEFAULT_MEDIA_PREFIX } from '../utils/constants';
import { runAiPreCheck } from './aiPreCheck';

function fakeSettings(
	overrides: Partial<AnkiBridgeSettings> = {},
): AnkiBridgeSettings {
	return {
		ankiConnectUrl: '',
		profiles: DEFAULT_SETTINGS.profiles,
		activeProfileId: DEFAULT_SETTINGS.activeProfileId,
		generateWithAiFields: {},
		imageConfigs: {},
		mainFieldConfig: {},
		generateExamples: {},
		textInstructions: {},
		textProviders: [],
		activeTextProviderId: '',
		imageProviders: [],
		activeImageProviderId: '',
		mediaPrefix: DEFAULT_MEDIA_PREFIX,
		autoSyncOnSave: false,
		nativeLanguage: '',
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
				'Please configure AI field generation for this Deck/Model in the sidebar (Text tab) first.',
		});
	});

	it('is not configured when the saved list for this pair is empty', () => {
		const key = fieldConfigKey('Japanese', 'Basic');
		const settings = fakeSettings({ generateWithAiFields: { [key]: [] } });

		expect(
			runAiPreCheck('generate-ai', settings, 'Japanese', 'Basic'),
		).toEqual({
			configured: false,
			message:
				'Please configure AI field generation for this Deck/Model in the sidebar (Text tab) first.',
		});
	});

	it('is configured when at least one field is ticked for this pair', () => {
		const key = fieldConfigKey('Japanese', 'Basic');
		const settings = fakeSettings({
			generateWithAiFields: { [key]: ['Meaning'] },
		});

		expect(
			runAiPreCheck('generate-ai', settings, 'Japanese', 'Basic'),
		).toEqual({
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
				'Please configure AI field generation for this Deck/Model in the sidebar (Text tab) first.',
		});
	});
});

describe('runAiPreCheck — add-image', () => {
	const notConfigured = {
		configured: false,
		message:
			'Please configure Image field mapping for this Deck/Model in the sidebar (Image tab) first.',
	};
	const key = fieldConfigKey('Japanese', 'Basic');

	it('is not configured when nothing is saved for this pair', () => {
		expect(
			runAiPreCheck('add-image', fakeSettings(), 'Japanese', 'Basic'),
		).toEqual(notConfigured);
	});

	it('is not configured when no Output field has been chosen', () => {
		const settings = fakeSettings({
			imageConfigs: { [key]: { outputField: '', onExisting: 'append' } },
		});

		expect(
			runAiPreCheck('add-image', settings, 'Japanese', 'Basic'),
		).toEqual(notConfigured);
	});

	it('is configured once an Output field is chosen for this pair', () => {
		const settings = fakeSettings({
			imageConfigs: {
				[key]: { outputField: 'Image', onExisting: 'append' },
			},
		});

		expect(
			runAiPreCheck('add-image', settings, 'Japanese', 'Basic'),
		).toEqual({
			configured: true,
		});
	});

	it('does not leak configuration from a different Deck+Model pair', () => {
		const settings = fakeSettings({
			imageConfigs: {
				[fieldConfigKey('Spanish', 'Cloze')]: {
					outputField: 'Image',
					onExisting: 'append',
				},
			},
		});

		expect(
			runAiPreCheck('add-image', settings, 'Japanese', 'Basic'),
		).toEqual(notConfigured);
	});
});
