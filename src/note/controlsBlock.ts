import type { MarkdownPostProcessorContext, Plugin } from 'obsidian';

// docs/design/03-note.md §3.1
export const CONTROLS_BLOCK_LANGUAGE = 'anki-controls';
export const CONTROLS_CONTAINER_CLASS = 'anki-bridge-controls';

export function registerControlsBlock(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor(CONTROLS_BLOCK_LANGUAGE, renderControlsBlock);
}

export function renderControlsBlock(
	_source: string,
	el: HTMLElement,
	_ctx: MarkdownPostProcessorContext,
): void {
	el.createDiv({ cls: CONTROLS_CONTAINER_CLASS });
}
