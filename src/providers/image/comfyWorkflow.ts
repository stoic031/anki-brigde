import { ProviderError } from '../../types';
import { obj, requestJson, trimSlash } from '../http';

const ID = 'comfyui';
const TIMEOUT_MS = 15_000;
const get = (url: string) =>
	requestJson('GET', ID, url, {}, undefined, TIMEOUT_MS);

// docs/design/06-settings.md §6.2 — the workflows saved in the user's ComfyUI (its `workflows/`
// folder, UI format). Newer builds serve them under /api/userdata; older ones under /userdata.
export async function listWorkflows(baseUrl: string): Promise<string[]> {
	const root = trimSlash(baseUrl);
	const url = `${root}/api/userdata?dir=workflows&recurse=true`;
	let data: unknown;
	try {
		data = await get(url);
	} catch (err) {
		if (
			!(err instanceof ProviderError) ||
			!err.message.includes('HTTP 404')
		)
			throw err;
		data = await get(`${root}/userdata?dir=workflows&recurse=true`);
	}
	if (!Array.isArray(data)) {
		throw new ProviderError(ID, `unexpected response shape from ${url}`);
	}
	const paths = data.flatMap((e: unknown) => {
		const path = typeof e === 'string' ? e : obj(e).path;
		return typeof path === 'string' && path.toLowerCase().endsWith('.json')
			? [path]
			: [];
	});
	return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}

export function fetchWorkflow(baseUrl: string, path: string): Promise<unknown> {
	return get(
		`${trimSlash(baseUrl)}/api/userdata/${encodeURIComponent(`workflows/${path}`)}`,
	);
}

export interface WorkflowNode {
	id: string;
	type: string;
}

export interface WorkflowAnalysis {
	positive?: WorkflowNode; // text-encode node feeding the sampler's `positive`
	negative?: WorkflowNode;
	checkpoint?: string;
	hasSave: boolean;
	problems: string[];
}

// A ComfyUI workflow reduced to what the plugin needs: where the image prompt would go.
// Handles the UI format (`nodes` + `links`, what ComfyUI saves) and the API format
// (`class_type` + `inputs`). Prompt nodes reached only through reroute/combine/subgraph
// nodes are not followed, so they show up as "not found".
export function analyzeWorkflow(json: unknown): WorkflowAnalysis {
	const graph = normalize(json);
	const problems: string[] = [];
	const sampler = graph.nodes.find((n) => n.type.startsWith('KSampler'));
	let positive: WorkflowNode | undefined;
	let negative: WorkflowNode | undefined;

	if (!sampler) {
		problems.push('no KSampler found');
	} else {
		positive = textNode(graph, sampler.id, 'positive');
		negative = textNode(graph, sampler.id, 'negative');
		if (!positive) problems.push('no positive prompt node found');
	}
	const hasSave = graph.nodes.some((n) => n.type.startsWith('SaveImage'));
	if (!hasSave) problems.push('no SaveImage node');

	return {
		positive,
		negative,
		checkpoint: graph.checkpoint,
		hasSave,
		problems,
	};
}

// One-line description for the settings row.
export function describeAnalysis(a: WorkflowAnalysis): string {
	const parts: string[] = [];
	if (a.positive)
		parts.push(
			`Positive prompt: node ${a.positive.id} (${a.positive.type})`,
		);
	if (a.negative) parts.push(`Negative: node ${a.negative.id}`);
	if (a.checkpoint) parts.push(`Checkpoint: ${a.checkpoint}`);
	const summary = parts.join(' · ');
	if (a.problems.length === 0) return summary;
	const warn = `⚠ ${a.problems.join('; ')}; image prompts can't be injected.`;
	return summary ? `${summary}. ${warn}` : warn;
}

interface Graph {
	nodes: { id: string; type: string }[];
	checkpoint?: string;
	// Source node id feeding `inputName` of node `id`, if that input is linked.
	source: (id: string, inputName: string) => string | undefined;
}

function textNode(
	graph: Graph,
	samplerId: string,
	input: string,
): WorkflowNode | undefined {
	const from = graph.source(samplerId, input);
	const node = graph.nodes.find((n) => n.id === from);
	return node && node.type.startsWith('CLIPTextEncode') ? node : undefined;
}

function normalize(json: unknown): Graph {
	const root = obj(json);
	return Array.isArray(root.nodes) ? fromUiFormat(root) : fromApiFormat(root);
}

function fromUiFormat(root: Record<string, unknown>): Graph {
	const raw = (root.nodes as unknown[]).map(obj);
	const nodes = raw.map((n) => ({
		id: String(n.id),
		type: typeof n.type === 'string' ? n.type : '',
	}));
	// links: [linkId, fromNode, fromSlot, toNode, toSlot, type]
	const fromByLink = new Map<number, string>();
	for (const l of Array.isArray(root.links) ? root.links : []) {
		if (Array.isArray(l) && typeof l[0] === 'number')
			fromByLink.set(l[0], String(l[1]));
	}
	const ckpt = raw.find((n) => n.type === 'CheckpointLoaderSimple');
	const widgets = Array.isArray(ckpt?.widgets_values)
		? ckpt.widgets_values
		: [];
	return {
		nodes,
		checkpoint: typeof widgets[0] === 'string' ? widgets[0] : undefined,
		source: (id, name) => {
			const node = raw.find((n) => String(n.id) === id);
			const inputs = Array.isArray(node?.inputs)
				? node.inputs.map(obj)
				: [];
			const link = inputs.find((i) => i.name === name)?.link;
			return typeof link === 'number' ? fromByLink.get(link) : undefined;
		},
	};
}

function fromApiFormat(root: Record<string, unknown>): Graph {
	const entries = Object.entries(root).filter(
		([, v]) => typeof obj(v).class_type === 'string',
	);
	const nodes = entries.map(([id, v]) => ({
		id,
		type: obj(v).class_type as string,
	}));
	const ckpt = entries.find(
		([, v]) => obj(v).class_type === 'CheckpointLoaderSimple',
	);
	const name = obj(obj(ckpt?.[1]).inputs).ckpt_name;
	return {
		nodes,
		checkpoint: typeof name === 'string' ? name : undefined,
		source: (id, input) => {
			const link = obj(obj(root[id]).inputs)[input];
			return Array.isArray(link) && link.length > 0
				? String(link[0])
				: undefined;
		},
	};
}

export type ApiPrompt = Record<
	string,
	{ class_type: string; inputs: Record<string, unknown> }
>;

const WIDGET_TYPES = new Set(['INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO']);

// UI format (`nodes` + `links`, what ComfyUI saves) → API format (what POST /prompt
// takes), using /object_info for each class's input order. An API-format workflow is
// returned unchanged. Widget values are matched to inputs positionally, the way the
// ComfyUI frontend does it; a seed widget carries one extra "control after generate" value.
// ponytail: muted/bypassed nodes and classes unknown to /object_info (Note, Reroute,
// PrimitiveNode) are dropped, so links through a Reroute break — ComfyUI then rejects
// the prompt with an HTTP error naming the node. Resolve reroutes if users hit that.
export function toApiPrompt(json: unknown, objectInfo: unknown): ApiPrompt {
	const root = obj(json);
	if (!Array.isArray(root.nodes)) return root as ApiPrompt;

	const linkSource = new Map<number, [string, number]>();
	for (const l of Array.isArray(root.links) ? root.links : []) {
		if (Array.isArray(l) && typeof l[0] === 'number')
			linkSource.set(l[0], [String(l[1]), Number(l[2])]);
	}

	const info = obj(objectInfo);
	const prompt: ApiPrompt = {};
	for (const node of (root.nodes as unknown[]).map(obj)) {
		const type = typeof node.type === 'string' ? node.type : '';
		const cls = obj(info[type]);
		if (!info[type] || (node.mode ?? 0) !== 0) continue;

		const links = new Map<string, number>();
		for (const i of Array.isArray(node.inputs)
			? node.inputs.map(obj)
			: []) {
			if (typeof i.name === 'string' && typeof i.link === 'number')
				links.set(i.name, i.link);
		}
		const widgets = node.widgets_values;
		let w = 0;
		const inputs: Record<string, unknown> = {};
		for (const [name, spec] of inputSpecs(cls)) {
			const kind = spec[0];
			const isWidget =
				Array.isArray(kind) ||
				(typeof kind === 'string' && WIDGET_TYPES.has(kind));
			let value: unknown;
			if (isWidget) {
				if (Array.isArray(widgets)) {
					value = widgets[w++];
					if (
						obj(spec[1]).control_after_generate === true ||
						(kind === 'INT' &&
							(name === 'seed' || name === 'noise_seed'))
					)
						w++;
				} else {
					value = obj(widgets)[name]; // some custom nodes save a dict
				}
			}
			const link = links.get(name);
			const source =
				link === undefined ? undefined : linkSource.get(link);
			if (source) inputs[name] = source;
			else if (value !== undefined) inputs[name] = value;
		}
		prompt[String(node.id)] = { class_type: type, inputs };
	}
	return prompt;
}

function inputSpecs(cls: Record<string, unknown>): [string, unknown[]][] {
	const input = obj(cls.input);
	const order = obj(cls.input_order);
	const specs: [string, unknown[]][] = [];
	for (const group of ['required', 'optional']) {
		const defs = obj(input[group]);
		const names = Array.isArray(order[group])
			? (order[group] as unknown[]).filter(
					(n): n is string => typeof n === 'string',
				)
			: Object.keys(defs);
		for (const name of names) {
			const spec = defs[name];
			specs.push([name, Array.isArray(spec) ? spec : []]);
		}
	}
	return specs;
}
