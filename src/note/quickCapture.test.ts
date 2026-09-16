import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import type { AnkiBridgeSettings } from '../settings';

const { MarkdownView } = vi.hoisted(() => ({
	MarkdownView: class FakeMarkdownView {},
}));
vi.mock('obsidian', () => ({ MarkdownView }));

import {
	getQuickCaptureFilename,
	getSelectedText,
	resolveQuickCaptureTarget,
} from './quickCapture';

function fakeSettings(
	overrides: Partial<AnkiBridgeSettings> = {},
): AnkiBridgeSettings {
	return {
		ankiConnectUrl: '',
		defaultDeck: '',
		defaultModel: '',
		currentDeck: '',
		currentModel: '',
		currentFolder: '',
		...overrides,
	};
}

function fakeApp(view: { editor: { getSelection: () => string } } | null): App {
	return {
		workspace: { getActiveViewOfType: vi.fn().mockReturnValue(view) },
	} as unknown as App;
}

describe('getSelectedText', () => {
	it('returns the editor selection when a markdown note is active', () => {
		const app = fakeApp({ editor: { getSelection: () => '薬' } });

		expect(getSelectedText(app)).toBe('薬');
	});

	it('returns an empty string when nothing is selected', () => {
		const app = fakeApp({ editor: { getSelection: () => '' } });

		expect(getSelectedText(app)).toBe('');
	});

	it('returns null when there is no active markdown note', () => {
		const app = fakeApp(null);

		expect(getSelectedText(app)).toBeNull();
	});
});

describe('getQuickCaptureFilename', () => {
	it('appends .md to the sanitized selected text', () => {
		expect(getQuickCaptureFilename('薬')).toBe('薬.md');
	});

	it('falls back to note.md when the selection is empty', () => {
		expect(getQuickCaptureFilename('')).toBe('note.md');
	});

	it('sanitizes path separators and whitespace before appending .md', () => {
		expect(getQuickCaptureFilename('a/b c')).toBe('ab_c.md');
	});
});

describe('resolveQuickCaptureTarget', () => {
	it('Branch A: uses the current Deck/Model/Folder when already set', () => {
		const settings = fakeSettings({
			currentDeck: 'Japanese',
			currentModel: 'Basic',
			currentFolder: 'Vocab',
			defaultDeck: 'Other',
			defaultModel: 'Other model',
		});

		expect(resolveQuickCaptureTarget(settings)).toEqual({
			deck: 'Japanese',
			model: 'Basic',
			folder: 'Vocab',
			seededFromDefaults: false,
		});
	});

	it('Branch B: falls back to Settings Tab defaults when current is unset', () => {
		const settings = fakeSettings({
			defaultDeck: 'Japanese',
			defaultModel: 'Basic',
			currentFolder: 'Vocab',
		});

		expect(resolveQuickCaptureTarget(settings)).toEqual({
			deck: 'Japanese',
			model: 'Basic',
			folder: 'Vocab',
			seededFromDefaults: true,
		});
	});

	it('returns null when neither current nor default Deck/Model are set', () => {
		expect(resolveQuickCaptureTarget(fakeSettings())).toBeNull();
	});
});
