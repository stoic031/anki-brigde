import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import {
	CONTROLS_BLOCK_LANGUAGE,
	CONTROLS_CONTAINER_CLASS,
	registerControlsBlock,
	renderControlsBlock,
} from './controlsBlock';

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
		const createDiv = vi.fn();
		const el = { createDiv } as unknown as HTMLElement;

		renderControlsBlock('', el, {} as never);

		expect(createDiv).toHaveBeenCalledTimes(1);
		expect(createDiv).toHaveBeenCalledWith({ cls: CONTROLS_CONTAINER_CLASS });
	});
});
