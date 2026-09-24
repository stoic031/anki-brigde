import type { ProviderConfig } from '../providerManager';
import type { ImageProvider } from '../types';
import { IMAGE_TIMEOUT_MS, requestBinary, requestJson } from '../text/http';
import { isLocalUrl, str } from '../text/openaiCompatible';
import { analyzeWorkflow, fetchWorkflow, toApiPrompt } from './comfyWorkflow';
import { media, noImage } from './media';
import { ProviderError } from '../../types';

const ID = 'comfyui';
const REQUEST_TIMEOUT_MS = 15_000;
// A local model may need a cold load before the first image — wait longer than cloud.
export const COMFY_RUN_TIMEOUT_MS = 300_000;
const POLL_MS = 1_000;

const obj = (v: unknown): Record<string, unknown> =>
	typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

interface OutputImage {
	filename: string;
	subfolder: string;
	type: string;
}

// docs/design/02-providers.md §2.2 — runs the workflow the user saved in ComfyUI with the
// AI prompt replacing the positive prompt node's text (negative node kept as saved).
export function createComfyUi(config: ProviderConfig): ImageProvider {
	const baseUrl = str(config.baseUrl).replace(/\/+$/, '');
	const workflow = str(config.workflow);
	const get = (url: string) =>
		requestJson('GET', ID, url, {}, undefined, REQUEST_TIMEOUT_MS);

	return {
		id: ID,
		isCloud: !isLocalUrl(baseUrl),
		async generateImage(prompt) {
			const saved = await fetchWorkflow(baseUrl, workflow);
			const api = toApiPrompt(saved, await get(`${baseUrl}/object_info`));
			const analysis = analyzeWorkflow(api);
			const positive = analysis.positive && api[analysis.positive.id];
			if (analysis.problems.length > 0 || !positive) {
				throw new ProviderError(
					ID,
					`workflow "${workflow}" can't take a prompt: ${analysis.problems.join('; ')}`,
				);
			}
			positive.inputs.text = prompt;
			// Same seed + same graph = ComfyUI serves its cache instead of a new image.
			for (const node of Object.values(api)) {
				for (const key of ['seed', 'noise_seed']) {
					if (typeof node.inputs[key] === 'number')
						node.inputs[key] = Math.floor(Math.random() * 2 ** 32);
				}
			}

			const queued = await requestJson(
				'POST',
				ID,
				`${baseUrl}/prompt`,
				{},
				{ prompt: api },
				REQUEST_TIMEOUT_MS,
			);
			const promptId = obj(queued).prompt_id;
			if (typeof promptId !== 'string')
				throw noImage(ID, `${baseUrl}/prompt`);

			const image = await waitForImage(baseUrl, promptId, get);
			const query = new URLSearchParams({ ...image });
			const res = await requestBinary(
				ID,
				`${baseUrl}/view?${query.toString()}`,
				{},
				IMAGE_TIMEOUT_MS,
			);
			return media(res.base64, res.mimeType);
		},
	};
}

async function waitForImage(
	baseUrl: string,
	promptId: string,
	get: (url: string) => Promise<unknown>,
): Promise<OutputImage> {
	const url = `${baseUrl}/history/${encodeURIComponent(promptId)}`;
	const deadline = Date.now() + COMFY_RUN_TIMEOUT_MS;
	while (Date.now() < deadline) {
		// ComfyUI adds the history entry only once the run has finished.
		const entry = obj(obj(await get(url))[promptId]);
		if (Object.keys(entry).length > 0) {
			if (obj(entry.status).status_str === 'error') {
				throw new ProviderError(
					ID,
					`workflow failed in ComfyUI (${url})`,
				);
			}
			const images = Object.values(obj(entry.outputs)).flatMap((o) => {
				const list = obj(o).images;
				return Array.isArray(list) ? list.map(obj) : [];
			});
			// SaveImage writes type "output"; PreviewImage only "temp".
			const pick = images.find((i) => i.type === 'output') ?? images[0];
			if (!pick || typeof pick.filename !== 'string')
				throw noImage(ID, url);
			return {
				filename: pick.filename,
				subfolder:
					typeof pick.subfolder === 'string' ? pick.subfolder : '',
				type: typeof pick.type === 'string' ? pick.type : 'output',
			};
		}
		await new Promise((r) => window.setTimeout(r, POLL_MS));
	}
	throw new ProviderError(
		ID,
		`timed out after ${COMFY_RUN_TIMEOUT_MS}ms waiting for the image (${url})`,
	);
}
