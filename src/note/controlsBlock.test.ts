import { describe, expect, it, vi } from 'vitest';
import type { App, MarkdownPostProcessorContext, Plugin } from 'obsidian';

const { TFile } = vi.hoisted(() => ({ TFile: class FakeTFile {} }));
vi.mock('obsidian', () => ({ TFile }));

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
		metadataCache: { getFileCache: () => (frontmatter ? { frontmatter } : null) },
	} as unknown as App;
}

interface RenderedButton {
	cls: string[];
	text: string;
	attr: Record<string, unknown>;
}

function fakeEl() {
	const buttons: RenderedButton[] = [];
	const container = {
		createEl: vi.fn((_tag: string, info: RenderedButton) => {
			buttons.push(info);
			return {} as HTMLElement;
		}),
	};
	const createDiv = vi.fn(() => container as unknown as HTMLElement);
	const el = { createDiv } as unknown as HTMLElement;
	return { el, createDiv, buttons };
}

function fakeCtx(): MarkdownPostProcessorContext {
	return { sourcePath: SOURCE_PATH } as unknown as MarkdownPostProcessorContext;
}

describe('registerControlsBlock', () => {
	it('registers the anki-controls language with Obsidian, delegating to renderControlsBlock with plugin.app', () => {
		const registerMarkdownCodeBlockProcessor = vi.fn();
		const app = fakeApp({ anki_note_id: 1 });
		const plugin = { app, registerMarkdownCodeBlockProcessor } as unknown as Plugin;

		registerControlsBlock(plugin);

		expect(registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
			CONTROLS_BLOCK_LANGUAGE,
			expect.any(Function),
		);

		const { el, buttons } = fakeEl();
		const processor = registerMarkdownCodeBlockProcessor.mock.calls[0]?.[1] as (
			source: string,
			el: HTMLElement,
			ctx: MarkdownPostProcessorContext,
		) => void;
		processor('', el, fakeCtx());

		expect(buttons.some((b) => b.attr['data-action'] === 'delete')).toBe(true);
	});
});

describe('renderControlsBlock', () => {
	it('renders a single controls container into the provided element', () => {
		const { el, createDiv } = fakeEl();

		renderControlsBlock(fakeApp(), '', el, fakeCtx());

		expect(createDiv).toHaveBeenCalledTimes(1);
		expect(createDiv).toHaveBeenCalledWith({ cls: CONTROLS_CONTAINER_CLASS });
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

		renderControlsBlock(fakeApp({ anki_note_id: 12345 }), '', el, fakeCtx());

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

		expect(buttons.some((b) => b.attr['data-action'] === 'delete')).toBe(false);
	});

	it('omits Delete when there is no frontmatter at all', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock(fakeApp(null), '', el, fakeCtx());

		expect(buttons.some((b) => b.attr['data-action'] === 'delete')).toBe(false);
	});

	it('gives each button a semantic class and label', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock(fakeApp({ anki_note_id: 1 }), '', el, fakeCtx());

		const sync = buttons.find((b) => b.attr['data-action'] === 'sync');
		expect(sync?.cls).toEqual([CONTROLS_BUTTON_CLASS, `${CONTROLS_BUTTON_CLASS}--sync`]);
		expect(sync?.text).toBe('🔄 Sync');

		const del = buttons.find((b) => b.attr['data-action'] === 'delete');
		expect(del?.cls).toEqual([CONTROLS_BUTTON_CLASS, `${CONTROLS_BUTTON_CLASS}--delete`]);
		expect(del?.text).toBe('🗑️ Delete');
	});
});
