import { describe, expect, it, vi } from 'vitest';
import type { MarkdownPostProcessorContext, Plugin } from 'obsidian';
import {
	CONTROLS_BLOCK_LANGUAGE,
	CONTROLS_BUTTON_CLASS,
	CONTROLS_CONTAINER_CLASS,
	registerControlsBlock,
	renderControlsBlock,
} from './controlsBlock';

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

function fakeCtx(frontmatter?: Record<string, unknown> | null): MarkdownPostProcessorContext {
	return { frontmatter } as unknown as MarkdownPostProcessorContext;
}

describe('registerControlsBlock', () => {
	it('registers the anki-controls language with Obsidian', () => {
		const registerMarkdownCodeBlockProcessor = vi.fn();
		const plugin = { registerMarkdownCodeBlockProcessor } as unknown as Plugin;

		registerControlsBlock(plugin);

		expect(registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
			CONTROLS_BLOCK_LANGUAGE,
			renderControlsBlock,
		);
	});
});

describe('renderControlsBlock', () => {
	it('renders a single controls container into the provided element', () => {
		const { el, createDiv } = fakeEl();

		renderControlsBlock('', el, fakeCtx());

		expect(createDiv).toHaveBeenCalledTimes(1);
		expect(createDiv).toHaveBeenCalledWith({ cls: CONTROLS_CONTAINER_CLASS });
	});

	it('renders Sync, Generate with AI, Add audio, and Add image when there is no anki_note_id', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock('', el, fakeCtx());

		expect(buttons.map((b) => b.attr['data-action'])).toEqual([
			'sync',
			'generate-ai',
			'add-audio',
			'add-image',
		]);
	});

	it('also renders Delete when frontmatter has anki_note_id', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock('', el, fakeCtx({ anki_note_id: 12345 }));

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

		renderControlsBlock('', el, fakeCtx({ anki_deck: 'Default', anki_model: 'Basic' }));

		expect(buttons.some((b) => b.attr['data-action'] === 'delete')).toBe(false);
	});

	it('omits Delete when there is no frontmatter at all', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock('', el, fakeCtx(null));

		expect(buttons.some((b) => b.attr['data-action'] === 'delete')).toBe(false);
	});

	it('gives each button a semantic class and label', () => {
		const { el, buttons } = fakeEl();

		renderControlsBlock('', el, fakeCtx({ anki_note_id: 1 }));

		const sync = buttons.find((b) => b.attr['data-action'] === 'sync');
		expect(sync?.cls).toEqual([CONTROLS_BUTTON_CLASS, `${CONTROLS_BUTTON_CLASS}--sync`]);
		expect(sync?.text).toBe('🔄 Sync');

		const del = buttons.find((b) => b.attr['data-action'] === 'delete');
		expect(del?.cls).toEqual([CONTROLS_BUTTON_CLASS, `${CONTROLS_BUTTON_CLASS}--delete`]);
		expect(del?.text).toBe('🗑️ Delete');
	});
});
