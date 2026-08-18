import { Plugin } from 'obsidian';
import { registerControlsBlock } from './note/controlsBlock';

export default class AnkiBridgePlugin extends Plugin {
	async onload(): Promise<void> {
		registerControlsBlock(this);
	}

	onunload(): void {}
}
