import { describe, expect, it, vi } from 'vitest';
import { IMAGE_PRESETS, TEXT_PRESETS, presetLabel } from './presets';
import { textFactories } from './text';

// The adapters import obsidian's requestUrl; nothing here calls it.
vi.mock('obsidian', () => ({ requestUrl: vi.fn() }));

describe('provider presets', () => {
	it('offers exactly the agreed fixed lists', () => {
		expect(Object.keys(TEXT_PRESETS).sort()).toEqual(
			[
				'anthropic',
				'gemini',
				'groq',
				'ollama',
				'openai',
				'openrouter',
				'together',
			].sort(),
		);
		expect(Object.keys(IMAGE_PRESETS).sort()).toEqual(
			[
				'automatic1111',
				'comfyui',
				'gemini',
				'openai',
				'openrouter',
				'pollinations',
			].sort(),
		);
	});

	it('every text preset maps to a registered text adapter', () => {
		for (const p of Object.values(TEXT_PRESETS)) {
			expect(textFactories, p.id).toHaveProperty(p.adapter);
		}
	});

	it('cloud presets have a fixed https endpoint; local ones an editable default', () => {
		for (const p of [
			...Object.values(TEXT_PRESETS),
			...Object.values(IMAGE_PRESETS),
		]) {
			if (p.cloud) {
				expect(p.baseUrl, p.id).toMatch(/^https:\/\//);
				expect(p.editableUrl, p.id).toBe(false);
			} else {
				expect(p.baseUrl, p.id).toMatch(/^http:\/\/localhost:\d+$/);
				expect(p.editableUrl, p.id).toBe(true);
			}
		}
	});

	it('marks the agreed providers as cloud or local', () => {
		const local = [
			...Object.values(TEXT_PRESETS),
			...Object.values(IMAGE_PRESETS),
		]
			.filter((p) => !p.cloud)
			.map((p) => p.id)
			.sort();
		expect(local).toEqual(['automatic1111', 'comfyui', 'ollama']);
	});

	it('gives Ollama the /v1 base its OpenAI-compatible adapter needs', () => {
		expect(TEXT_PRESETS.ollama.apiBase('http://localhost:11434/')).toBe(
			'http://localhost:11434/v1',
		);
	});

	it('labels presets with cloud or local', () => {
		expect(presetLabel(TEXT_PRESETS.openai)).toBe('OpenAI (cloud)');
		expect(presetLabel(TEXT_PRESETS.ollama)).toBe('Ollama (local)');
	});
});
