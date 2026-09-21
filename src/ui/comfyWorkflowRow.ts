import { Setting } from 'obsidian';
import {
	analyzeWorkflow,
	describeAnalysis,
	fetchWorkflow,
	listWorkflows,
	type WorkflowAnalysis,
} from '../providers/image/comfyWorkflow';
import { ProviderError } from '../types';

// The bits of an image provider config this row edits.
export interface WorkflowHolder {
	id: string;
	baseUrl: string;
	workflow: string;
}

// docs/design/06-settings.md §6.2 — what ComfyUI reported, kept in memory for the session.
// Filled only by user actions (edit Base URL/provider, pick a workflow, Refresh), never on open.
interface WorkflowState {
	loading?: boolean;
	workflows?: string[];
	error?: string;
	analysis?: WorkflowAnalysis;
	analysisError?: string;
}
const states = new Map<string, WorkflowState>();

// For tests: the cache is module-level, so it would leak between cases.
export const clearWorkflowCache = (): void => states.clear();

const reason = (err: unknown): string => {
	const text =
		err instanceof ProviderError ? err.message : 'unexpected error.';
	return text.endsWith('.') ? text : `${text}.`;
};

// Lists the saved workflows and re-checks the selected one.
export async function refreshWorkflows(
	config: WorkflowHolder,
	render: () => void,
): Promise<void> {
	if (config.baseUrl === '') {
		states.delete(config.id);
		render();
		return;
	}
	states.set(config.id, { loading: true });
	render();
	try {
		states.set(config.id, {
			workflows: await listWorkflows(config.baseUrl),
		});
	} catch (err) {
		states.set(config.id, { error: reason(err) });
	}
	if (config.workflow !== '' && !states.get(config.id)?.error) {
		await analyzeSelected(config, render, false);
	}
	render();
}

async function analyzeSelected(
	config: WorkflowHolder,
	render: () => void,
	draw = true,
): Promise<void> {
	const prev = states.get(config.id) ?? {};
	try {
		const analysis = analyzeWorkflow(
			await fetchWorkflow(config.baseUrl, config.workflow),
		);
		states.set(config.id, { ...prev, analysis, analysisError: undefined });
	} catch (err) {
		states.set(config.id, {
			...prev,
			analysis: undefined,
			analysisError: reason(err),
		});
	}
	if (draw) render();
}

export function renderWorkflowRow(
	el: HTMLElement,
	config: WorkflowHolder,
	save: () => Promise<void>,
	render: () => void,
): void {
	const state = states.get(config.id) ?? {};
	const workflows = state.workflows ?? [];
	const setting = new Setting(el).setName('Workflow');

	if (state.loading) {
		setting.setDesc('Loading workflows…');
	} else if (state.error) {
		setting.setDesc(
			`Couldn't load workflows: ${state.error} Type the workflow path instead.`,
		);
	} else if (config.workflow !== '' && state.analysisError) {
		setting.setDesc(`Couldn't read this workflow: ${state.analysisError}`);
	} else if (config.workflow !== '' && state.analysis) {
		setting.setDesc(describeAnalysis(state.analysis));
	} else if (state.workflows && workflows.length === 0) {
		setting.setDesc('No saved workflows found. Save one in ComfyUI first.');
	} else if (workflows.length > 0) {
		setting.setDesc(
			`${workflows.length} saved workflows. Pick the one to run.`,
		);
	} else {
		setting.setDesc('Refresh to list the workflows saved in ComfyUI.');
	}

	if (workflows.length > 0) {
		setting.addDropdown((dropdown) => {
			if (config.workflow === '')
				dropdown.addOption('', 'Select a workflow…');
			// A saved workflow ComfyUI no longer lists still shows.
			const options =
				workflows.includes(config.workflow) || config.workflow === ''
					? workflows
					: [config.workflow, ...workflows];
			for (const path of options) dropdown.addOption(path, path);
			dropdown.setValue(config.workflow).onChange(async (value) => {
				config.workflow = value;
				await save();
				states.set(config.id, {
					...(states.get(config.id) ?? {}),
					analysis: undefined,
					analysisError: undefined,
				});
				if (value === '') render();
				else await analyzeSelected(config, render);
			});
		});
	} else {
		setting.addText((text) => {
			text.setPlaceholder('my-workflow.json').setValue(config.workflow);
			text.inputEl.addEventListener('change', () => {
				void (async () => {
					config.workflow = text.getValue().trim();
					await save();
					if (config.workflow !== '' && config.baseUrl !== '')
						await analyzeSelected(config, render);
					else render();
				})();
			});
		});
	}

	setting.addButton((button) =>
		button
			.setButtonText('Refresh')
			.setDisabled(state.loading === true || config.baseUrl === '')
			.onClick(() => refreshWorkflows(config, render)),
	);
}
