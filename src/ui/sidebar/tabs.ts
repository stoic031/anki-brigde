export interface Tab {
	id: string;
	label: string;
}

// docs/design/07-sidebar.md §7.2 — tab bar plus one panel per tab; only the selected
// panel is visible. Returns the panels so the caller can render into them. The first tab
// starts selected; the choice lives only as long as the view.
export function renderTabs(
	parent: HTMLElement,
	tabs: Tab[],
): Record<string, HTMLElement> {
	const bar = parent.createDiv({
		cls: 'anki-bridge-sidebar__tabs',
		attr: { role: 'tablist' },
	});
	const buttons: Record<string, HTMLElement> = {};
	const panels: Record<string, HTMLElement> = {};

	const select = (id: string) => {
		for (const tab of tabs) {
			const active = tab.id === id;
			buttons[tab.id]?.toggleClass('is-active', active);
			buttons[tab.id]?.setAttr('aria-selected', String(active));
			panels[tab.id]?.toggleClass('anki-bridge-sidebar__panel--hidden', !active);
		}
	};

	for (const tab of tabs) {
		const button = bar.createEl('button', {
			cls: 'anki-bridge-sidebar__tab',
			text: tab.label,
			attr: { type: 'button', role: 'tab' },
		});
		button.addEventListener('click', () => select(tab.id));
		buttons[tab.id] = button;
	}
	// Panels come after the whole bar so the DOM order is bar, then panels.
	for (const tab of tabs) {
		panels[tab.id] = parent.createDiv({
			cls: 'anki-bridge-sidebar__panel',
			attr: { role: 'tabpanel' },
		});
	}

	if (tabs[0]) select(tabs[0].id);
	return panels;
}
