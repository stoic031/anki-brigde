import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';

const { MarkdownView } = vi.hoisted(() => ({
	MarkdownView: class FakeMarkdownView {},
}));
vi.mock('obsidian', () => ({ MarkdownView }));

import { getSelectedText } from './quickCapture';

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
