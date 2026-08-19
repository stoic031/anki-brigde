import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, MarkdownPostProcessorContext, Plugin } from 'obsidian';

const { TFile } = vi.hoisted(() => ({
	TFile: class FakeTFile {},
}));
vi.mock('obsidian', () => ({ TFile }));

const { syncNote } = vi.hoisted(() => ({ syncNote: vi.fn() }));
vi.mock('../sync/syncEngine', () => ({ syncNote }));

const { toastSuccess, toastError } = vi.hoisted(() => ({
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
}));
vi.mock('../ui/toast', () => ({ toastSuccess, toastError }));

import { AnkiConnectClient } from '../sync/ankiConnect';
import { SyncError } from '../types';
import {
	CONTROLS_BLOCK_LANGUAGE,
	CONTROLS_BUTTON_CLASS,
	CONTROLS_CONTAINER_CLASS,
	registerControlsBlock,
	renderControlsBlock,
} from './controlsBlock';

const SOURCE_PATH = 'QA-71-has-note-id.md';

function fakeApp(frontmatter?: Record<string, unknown> | null): App {
	const file = Object.create(TFile.prototype) as InstanceType<typeof TFile>;
	return {
		vault: { getAbstractFileByPath: () => file },
		metadataCache: {
			getFileCache: () => (frontmatter ? { frontmatter } : null),
		},
	} as unknown as App;
}

interface RenderedButton {
	cls: string[];
	text: string;
	attr: Record<string, unknown>;
	disabled: boolean;
	setText: (t: string) => void;
	addEventListener: (type: string, cb: () => unknown) => void;
	dispatch: (type: string) => unknown;
}

function fakeEl() {
	const buttons: RenderedButton[] = [];
	const container = {
		createEl: vi.fn(
			(
				_tag: string,
				info: {
					cls: string[];
					text: string;
					attr: Record<string, unknown>;
				},
			) => {
				const listeners: Record<string, Array<() => unknown>> = {};
				const button: RenderedButton = {
					cls: info.cls,
					text: info.text,
					attr: info.attr,
					disabled: false,
					setText(t) {
						button.text = t;
					},
					addEventListener(type, cb) {
						(listeners[type] ??= []).push(cb);
					},
					dispatch(type) {
						return listeners[type]?.map((cb) => cb())[0];
					},
				};
				buttons.push(button);
				return button as unknown as HTMLElement;
			},
		),
	};
	const createDiv = vi.fn(() => container as unknown as HTMLElement);
	const el = { createDiv } as unknown as HTMLElement;
	return { el, createDiv, buttons };
}

function fakeCtx(): MarkdownPostProcessorContext {
	return {
		sourcePath: SOURCE_PATH,
	} as unknown as MarkdownPostProcessorContext;
}

describe('registerControlsBlock', () => {
	it('registers the anki-controls language with Obsidian, delegating to renderControlsBlock with plugin.app', () => {
		const registerMarkdownCodeBlockProcessor = vi.fn();
		const app = fakeApp({ anki_note_id: 1 });
		const plugin = {
			app,
			registerMarkdownCodeBlockProcessor,
		} as unknown as Plugin;

		registerControlsBlock(plugin);

		expect(registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
			CONTROLS_BLOCK_LANGUAGE,
			expect.any(Function),
		);

		const { el, buttons } = fakeEl();
		const processor = registerMarkdownCodeBlockProcessor.mock
			.calls[0]?.[1] as (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void;
		processor('', el, fakeCtx());

		expect(buttons.some((b) => b.attr['data-action'] === 'delete')).toBe(
			true,
		);
	});
});

describe('renderControlsBlock', () => {
	it('renders a single controls container into the provided element', () => {
		const { el, createDiv } = fakeEl();

		renderControlsBlock(fakeApp(), '', el, fakeCtx());

		expect(createDiv).toHaveBeenCalledTimes(1);
		expect(createDiv).toHaveBeenCalledWith({
			cls: CONTROLS_CONTAINER_CLASS,
		});
	});

	it('renders Sync, Generate with AI, Add audio, and Add image when there is no anki_note_id', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock(fakeApp(), '', el, fakeCtx());

		expect(buttons.map((b) => b.attr['data-action'])).toEqual([
			'sync',
			'generate-ai',
			'add-audio',
			'add-image',
		]);
	});

	it('also renders Delete when frontmatter has anki_note_id', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock(
			fakeApp({ anki_note_id: 12345 }),
			'',
			el,
			fakeCtx(),
		);

		expect(buttons.map((b) => b.attr['data-action'])).toEqual([
			'sync',
			'generate-ai',
			'add-audio',
			'add-image',
			'delete',
		]);
	});

	it('omits Delete when frontmatter has no anki_note_id', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock(
			fakeApp({ anki_deck: 'Default', anki_model: 'Basic' }),
			'',
			el,
			fakeCtx(),
		);

		expect(buttons.some((b) => b.attr['data-action'] === 'delete')).toBe(
			false,
		);
	});

	it('omits Delete when there is no frontmatter at all', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock(fakeApp(null), '', el, fakeCtx());

		expect(buttons.some((b) => b.attr['data-action'] === 'delete')).toBe(
			false,
		);
	});

	it('gives each button a semantic class and label', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock(fakeApp({ anki_note_id: 1 }), '', el, fakeCtx());

		const sync = buttons.find((b) => b.attr['data-action'] === 'sync');
		expect(sync?.cls).toEqual([
			CONTROLS_BUTTON_CLASS,
			`${CONTROLS_BUTTON_CLASS}--sync`,
		]);
		expect(sync?.text).toBe('🔄 Sync');

		const del = buttons.find((b) => b.attr['data-action'] === 'delete');
		expect(del?.cls).toEqual([
			CONTROLS_BUTTON_CLASS,
			`${CONTROLS_BUTTON_CLASS}--delete`,
		]);
		expect(del?.text).toBe('🗑️ Delete');
	});
});

describe('sync button handler', () => {
	beforeEach(() => {
		syncNote.mockReset();
		toastSuccess.mockClear();
		toastError.mockClear();
		vi.useFakeTimers();
		// controlsBlock.ts calls window.setTimeout for Obsidian popout-window
		// compatibility (matches src/sync/ankiConnect.ts's convention) — vitest runs in
		// a plain Node environment with no `window`, so alias it to globalThis.
		vi.stubGlobal('window', globalThis);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	function renderAndGetSyncButton() {
		const app = fakeApp();
		const { el, buttons } = fakeEl();
		renderControlsBlock(app, '', el, fakeCtx());
		const button = buttons.find((b) => b.attr['data-action'] === 'sync');
		if (!button) throw new Error('sync button not rendered');
		return { app, button };
	}

	it('calls syncNote with the app, file, and an AnkiConnectClient', async () => {
		syncNote.mockResolvedValue(undefined);
		const { app, button } = renderAndGetSyncButton();

		await button.dispatch('click');

		expect(syncNote).toHaveBeenCalledTimes(1);
		expect(syncNote).toHaveBeenCalledWith(
			app,
			expect.anything(),
			expect.any(AnkiConnectClient),
		);
	});

	it('shows the processing state immediately, before syncNote resolves', () => {
		syncNote.mockResolvedValue(undefined);
		const { button } = renderAndGetSyncButton();

		void button.dispatch('click');

		expect(button.disabled).toBe(true);
		expect(button.text).toBe('⏳ Processing...');
	});

	it('shows success, toasts, then reverts after 2s', async () => {
		syncNote.mockResolvedValue(undefined);
		const { button } = renderAndGetSyncButton();

		await button.dispatch('click');

		expect(button.text).toBe('✅ Done!');
		expect(toastSuccess).toHaveBeenCalledWith('✅ Note synced to Anki!');

		vi.advanceTimersByTime(2000);

		expect(button.text).toBe('🔄 Sync');
		expect(button.disabled).toBe(false);
	});

	it('shows the generic fallback toast, then reverts after 3s, for a non-SyncError rejection', async () => {
		syncNote.mockRejectedValue(new Error('boom'));
		const { button } = renderAndGetSyncButton();

		await button.dispatch('click');

		expect(button.text).toBe('❌ Error');
		expect(toastError).toHaveBeenCalledWith(
			'❌ Failed to sync. Please check Anki connection.',
		);

		vi.advanceTimersByTime(3000);

		expect(button.text).toBe('🔄 Sync');
		expect(button.disabled).toBe(false);
	});

	it('shows the SyncError-specific message instead of the generic fallback', async () => {
		syncNote.mockRejectedValue(
			new SyncError(
				'model-not-found',
				'Model not found in Anki. Please select it again.',
			),
		);
		const { button } = renderAndGetSyncButton();

		await button.dispatch('click');

		expect(button.text).toBe('❌ Error');
		expect(toastError).toHaveBeenCalledWith(
			'❌ Model not found in Anki. Please select it again.',
		);
	});

	it('ignores a click while already processing', () => {
		syncNote.mockResolvedValue(undefined);
		const { button } = renderAndGetSyncButton();

		void button.dispatch('click');
		void button.dispatch('click');

		expect(syncNote).toHaveBeenCalledTimes(1);
	});
});
