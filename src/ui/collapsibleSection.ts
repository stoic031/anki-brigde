import { setIcon } from 'obsidian';

// docs/design/06-settings.md — Settings tab is grouped into collapsible sections
// (native <details>/<summary>, no JS framework) so the long list of fields doesn't
// all show at once. Returns the body element for the caller to render its own
// Setting rows into, same shape as every other render*Section(containerEl, plugin)
// function in this folder.
export function renderCollapsibleSection(
	containerEl: HTMLElement,
	title: string,
	defaultOpen: boolean,
): HTMLElement {
	const details = containerEl.createEl('details', {
		cls: 'anki-bridge-settings__section',
	});
	if (defaultOpen) details.setAttr('open', '');

	const summary = details.createEl('summary', {
		cls: 'anki-bridge-settings__section-summary',
	});
	const chevron = summary.createSpan({
		cls: 'anki-bridge-settings__section-chevron',
	});
	setIcon(chevron, 'chevron-right');
	summary.createSpan({ text: title });

	return details.createDiv({ cls: 'anki-bridge-settings__section-body' });
}
