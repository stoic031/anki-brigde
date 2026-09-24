import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../types';
import {
	analyzeWorkflow,
	describeAnalysis,
	fetchWorkflow,
	listWorkflows,
	toApiPrompt,
} from './comfyWorkflow';

const { requestUrl } = vi.hoisted(() => ({ requestUrl: vi.fn() }));
vi.mock('obsidian', () => ({ requestUrl }));

const ok = (data: unknown) => ({ status: 200, text: JSON.stringify(data) });
const urls = () =>
	requestUrl.mock.calls.map((c) => (c[0] as { url: string }).url);

beforeEach(() => {
	requestUrl.mockReset();
	vi.stubGlobal('window', globalThis);
});
afterEach(() => vi.unstubAllGlobals());

// The shape of a workflow saved by ComfyUI (UI format), reduced from a real
// Checkpoint → LoRA → 2× CLIPTextEncode → KSampler → VAEDecode → SaveImage graph.
const uiWorkflow = {
	nodes: [
		{
			id: 8,
			type: 'VAEDecode',
			inputs: [
				{ name: 'samples', link: 7 },
				{ name: 'vae', link: 13 },
			],
		},
		{
			id: 16,
			type: 'LoraLoader',
			inputs: [
				{ name: 'model', link: 20 },
				{ name: 'clip', link: 22 },
			],
		},
		{
			id: 12,
			type: 'CheckpointLoaderSimple',
			inputs: [{ name: 'ckpt_name', link: null }],
			widgets_values: ['cartoonxl_v10.safetensors'],
		},
		{ id: 9, type: 'SaveImage', inputs: [{ name: 'images', link: 9 }] },
		{
			id: 4,
			type: 'CLIPTextEncode',
			inputs: [
				{ name: 'clip', link: 23 },
				{ name: 'text', link: null },
			],
			widgets_values: ['a cat'],
		},
		{
			id: 5,
			type: 'CLIPTextEncode',
			inputs: [
				{ name: 'clip', link: 24 },
				{ name: 'text', link: null },
			],
			widgets_values: ['blurry'],
		},
		{ id: 6, type: 'EmptyLatentImage', inputs: [] },
		{
			id: 7,
			type: 'KSampler',
			inputs: [
				{ name: 'model', link: 21 },
				{ name: 'positive', link: 4 },
				{ name: 'negative', link: 5 },
				{ name: 'latent_image', link: 6 },
				{ name: 'seed', link: null },
			],
		},
	],
	links: [
		[4, 4, 0, 7, 1, 'CONDITIONING'],
		[5, 5, 0, 7, 2, 'CONDITIONING'],
		[6, 6, 0, 7, 3, 'LATENT'],
		[7, 7, 0, 8, 0, 'LATENT'],
		[9, 8, 0, 9, 0, 'IMAGE'],
		[13, 12, 2, 8, 1, 'VAE'],
	],
};

describe('listWorkflows', () => {
	it('lists saved .json workflows from /api/userdata, sorted and de-duplicated', async () => {
		requestUrl.mockResolvedValue(
			ok(['b.json', 'sub/a.json', 'notes.txt', 'b.json']),
		);

		expect(await listWorkflows('http://localhost:8188/')).toEqual([
			'b.json',
			'sub/a.json',
		]);
		expect(urls()).toEqual([
			'http://localhost:8188/api/userdata?dir=workflows&recurse=true',
		]);
	});

	it('accepts entries that are objects with a path', async () => {
		requestUrl.mockResolvedValue(
			ok([{ path: 'Unsaved Workflow.json', size: 1 }, { size: 2 }]),
		);

		expect(await listWorkflows('http://localhost:8188')).toEqual([
			'Unsaved Workflow.json',
		]);
	});

	it('falls back to /userdata when /api/userdata is not there', async () => {
		requestUrl
			.mockResolvedValueOnce({ status: 404, text: '' })
			.mockResolvedValueOnce(ok(['old.json']));

		expect(await listWorkflows('http://localhost:8188')).toEqual([
			'old.json',
		]);
		expect(urls()[1]).toBe(
			'http://localhost:8188/userdata?dir=workflows&recurse=true',
		);
	});

	it('does not retry other failures, and names ComfyUI and the URL', async () => {
		requestUrl.mockRejectedValue(new Error('ECONNREFUSED'));
		await expect(listWorkflows('http://localhost:8188')).rejects.toThrow(
			/comfyui: could not reach the endpoint \(http:\/\/localhost:8188\/api\/userdata/,
		);
		expect(requestUrl).toHaveBeenCalledTimes(1);

		requestUrl.mockResolvedValue(ok({ not: 'a list' }));
		await expect(
			listWorkflows('http://localhost:8188'),
		).rejects.toBeInstanceOf(ProviderError);
	});
});

describe('fetchWorkflow', () => {
	it('encodes the path, including folders and spaces', async () => {
		requestUrl.mockResolvedValue(ok(uiWorkflow));

		await fetchWorkflow('http://localhost:8188', 'sub/My Workflow.json');

		expect(urls()[0]).toBe(
			'http://localhost:8188/api/userdata/workflows%2Fsub%2FMy%20Workflow.json',
		);
	});
});

describe('analyzeWorkflow', () => {
	it('finds the positive and negative prompt nodes and the checkpoint in a UI-format workflow', () => {
		const a = analyzeWorkflow(uiWorkflow);

		expect(a).toEqual({
			positive: { id: '4', type: 'CLIPTextEncode' },
			negative: { id: '5', type: 'CLIPTextEncode' },
			checkpoint: 'cartoonxl_v10.safetensors',
			hasSave: true,
			problems: [],
		});
		expect(describeAnalysis(a)).toBe(
			'Positive prompt: node 4 (CLIPTextEncode) · Negative: node 5 · Checkpoint: cartoonxl_v10.safetensors',
		);
	});

	it('understands the API format too', () => {
		const a = analyzeWorkflow({
			'3': {
				class_type: 'KSampler',
				inputs: { positive: ['6', 0], negative: ['7', 0], seed: 1 },
			},
			'4': {
				class_type: 'CheckpointLoaderSimple',
				inputs: { ckpt_name: 'sd15.ckpt' },
			},
			'6': {
				class_type: 'CLIPTextEncode',
				inputs: { text: 'a', clip: ['4', 1] },
			},
			'7': {
				class_type: 'CLIPTextEncode',
				inputs: { text: 'b', clip: ['4', 1] },
			},
			'9': { class_type: 'SaveImage', inputs: {} },
		});

		expect(a).toMatchObject({
			positive: { id: '6' },
			negative: { id: '7' },
			checkpoint: 'sd15.ckpt',
			hasSave: true,
			problems: [],
		});
	});

	it('reports what is missing and warns that prompts cannot be injected', () => {
		const a = analyzeWorkflow({
			nodes: [{ id: 1, type: 'EmptyLatentImage', inputs: [] }],
			links: [],
		});

		expect(a.problems).toEqual(['no KSampler found', 'no SaveImage node']);
		expect(describeAnalysis(a)).toBe(
			"⚠ no KSampler found; no SaveImage node; image prompts can't be injected.",
		);
	});

	it('does not follow a prompt reached through a non-text node', () => {
		const wf = structuredClone(uiWorkflow);
		wf.nodes = wf.nodes.map((n) =>
			n.id === 4 ? { ...n, type: 'ConditioningCombine' } : n,
		);

		const a = analyzeWorkflow(wf);

		expect(a.positive).toBeUndefined();
		expect(a.problems).toContain('no positive prompt node found');
		expect(a.negative).toEqual({ id: '5', type: 'CLIPTextEncode' });
	});

	it('survives garbage input', () => {
		expect(analyzeWorkflow(null).problems).toContain('no KSampler found');
		expect(analyzeWorkflow('x').hasSave).toBe(false);
	});
});

describe('toApiPrompt', () => {
	const objectInfo = {
		KSampler: {
			input: {
				required: {
					model: ['MODEL'],
					seed: ['INT', {}],
					steps: ['INT', {}],
					sampler_name: [['euler', 'dpmpp']],
					positive: ['CONDITIONING'],
				},
			},
			input_order: {
				required: [
					'model',
					'seed',
					'steps',
					'sampler_name',
					'positive',
				],
			},
		},
		CLIPTextEncode: {
			input: { required: { text: ['STRING', {}], clip: ['CLIP'] } },
		},
	};

	it('maps widgets positionally, skips the seed control value, and resolves links', () => {
		const ui = {
			nodes: [
				{
					id: 3,
					type: 'KSampler',
					mode: 0,
					inputs: [
						{ name: 'model', link: 1 },
						{ name: 'positive', link: 2 },
					],
					widgets_values: [42, 'randomize', 20, 'euler'],
				},
				{ id: 6, type: 'CLIPTextEncode', widgets_values: ['a dog'] },
				{ id: 10, type: 'Note', widgets_values: ['ignore me'] },
				{
					id: 11,
					type: 'CLIPTextEncode',
					mode: 2,
					widgets_values: ['muted'],
				},
			],
			links: [
				[1, 4, 0, 3, 0, 'MODEL'],
				[2, 6, 0, 3, 4, 'CONDITIONING'],
			],
		};
		expect(toApiPrompt(ui, objectInfo)).toEqual({
			'3': {
				class_type: 'KSampler',
				inputs: {
					model: ['4', 0],
					seed: 42,
					steps: 20,
					sampler_name: 'euler',
					positive: ['6', 0],
				},
			},
			'6': { class_type: 'CLIPTextEncode', inputs: { text: 'a dog' } },
		});
	});

	it('returns an API-format workflow unchanged', () => {
		const api = { '1': { class_type: 'SaveImage', inputs: {} } };
		expect(toApiPrompt(api, objectInfo)).toBe(api);
	});
});
