import { setIcon } from 'obsidian';
import type VocabWeavePlugin from '../../main';
import { defaultInstruction } from '../../providers/text/prompt';
import { examplesKey, fieldConfigKey, getActiveProfile } from '../../settings';

export interface PromptBox {
	// Re-reads the instruction saved for this pair and the parts added automatically.
	// Empty deck/model hides the box.
	render(deck: string, model: string, fieldCount: number): void;
}

// docs/design/07-sidebar.md §7.2.1 — Text tab "Prompt" box: collapsed by default, the
// summary badge says Default/Custom so the state is visible without opening it. Only the
// instruction is editable; what the plugin appends (language, examples, JSON format) is
// listed read-only below, reflecting what the next Generate will actually send.
export function renderPromptBox(
	parent: HTMLElement,
	plugin: VocabWeavePlugin,
): PromptBox {
	// Same native <details> look as the Settings tab sections (collapsibleSection.ts),
	// built here because the summary also carries the badge.
	const details = parent.createEl('details', {
		cls: ['vocabweave-settings__section', 'vocabweave-sidebar__prompt'],
	});
	const summary = details.createEl('summary', {
		cls: 'vocabweave-settings__section-summary',
	});
	setIcon(
		summary.createSpan({ cls: 'vocabweave-settings__section-chevron' }),
		'chevron-right',
	);
	summary.createSpan({ text: 'Prompt' });
	const badge = summary.createSpan({ cls: 'vocabweave-sidebar__badge' });
	const body = details.createDiv({
		cls: 'vocabweave-settings__section-body',
	});

	const render = (deck: string, model: string, fieldCount: number): void => {
		body.empty();
		details.hidden = !deck || !model;
		if (details.hidden) return;

		const key = fieldConfigKey(deck, model);
		const custom = plugin.settings.textInstructions[key];
		badge.setText(custom === undefined ? 'Default' : 'Custom');
		badge.toggleClass(
			'vocabweave-sidebar__badge--accent',
			custom !== undefined,
		);

		const area = body.createEl('textarea', {
			cls: 'vocabweave-sidebar__prompt-input',
			attr: { rows: '4', spellcheck: 'false' },
		});
		area.value = custom ?? defaultInstruction('extract-vocabulary');
		// Saved on blur, not per keystroke. Blank or unchanged-from-default stores
		// nothing, so a later change to the built-in default still reaches this pair.
		area.addEventListener('change', () => {
			const value = area.value.trim();
			if (
				value === '' ||
				value === defaultInstruction('extract-vocabulary')
			) {
				delete plugin.settings.textInstructions[key];
			} else {
				plugin.settings.textInstructions[key] = value;
			}
			void plugin.saveSettings();
			render(deck, model, fieldCount);
		});

		if (custom !== undefined) {
			const reset = body.createEl('button', {
				cls: 'vocabweave-sidebar__prompt-reset',
				text: 'Reset to default',
				attr: { type: 'button' },
			});
			reset.addEventListener('click', () => {
				delete plugin.settings.textInstructions[key];
				void plugin.saveSettings();
				render(deck, model, fieldCount);
			});
		}

		const target = getActiveProfile(plugin.settings).targetLanguage;
		const native = plugin.settings.nativeLanguage;
		const examples =
			plugin.settings.generateExamples[examplesKey(deck, model, target)]
				?.length ?? 0;
		const parts = [
			...(target ? [`Learning language (${target})`] : []),
			...(native ? [`your language (${native})`] : []),
			...(examples > 0
				? [
						`${examples} approved card${examples === 1 ? '' : 's'} as examples`,
					]
				: []),
			`JSON format for ${fieldCount} field${fieldCount === 1 ? '' : 's'}`,
		];
		body.createEl('p', {
			cls: 'vocabweave-sidebar__hint',
			text: `Also sent automatically: ${parts.join(', ')}.`,
		});
	};

	return { render };
}
