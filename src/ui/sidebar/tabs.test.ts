import { describe, expect, it } from 'vitest';
import { FakeEl } from '../../test/fakeDom';
import { renderTabs } from './tabs';

const HIDDEN = 'vocabweave-sidebar__panel--hidden';
const tabs = [
	{ id: 'note', label: 'Note' },
	{ id: 'text', label: 'Text' },
];

function render() {
	const parent = new FakeEl();
	const panels = renderTabs(
		parent as unknown as HTMLElement,
		tabs,
	) as unknown as Record<string, FakeEl>;
	const buttons = parent.byClass('vocabweave-sidebar__tab');
	return { parent, panels, buttons };
}

describe('renderTabs', () => {
	it('renders a tab per entry, in order, followed by one panel per tab', () => {
		const { parent, buttons } = render();

		expect(buttons.map((b) => b.text)).toEqual(['Note', 'Text']);
		expect(parent.children.map((c) => c.attrs.role)).toEqual([
			'tablist',
			'tabpanel',
			'tabpanel',
		]);
	});

	it('starts on the first tab: its panel shown, the others hidden', () => {
		const { panels, buttons } = render();

		expect(panels.note?.hasClass(HIDDEN)).toBe(false);
		expect(panels.text?.hasClass(HIDDEN)).toBe(true);
		expect(buttons[0]?.hasClass('is-active')).toBe(true);
		expect(buttons[0]?.attrs['aria-selected']).toBe('true');
		expect(buttons[1]?.attrs['aria-selected']).toBe('false');
	});

	it('clicking a tab shows only its panel and marks it active', async () => {
		const { panels, buttons } = render();

		await buttons[1]?.click();

		expect(panels.note?.hasClass(HIDDEN)).toBe(true);
		expect(panels.text?.hasClass(HIDDEN)).toBe(false);
		expect(buttons[0]?.hasClass('is-active')).toBe(false);
		expect(buttons[1]?.hasClass('is-active')).toBe(true);
	});

	it('can switch back and forth', async () => {
		const { panels, buttons } = render();

		await buttons[1]?.click();
		await buttons[0]?.click();

		expect(panels.note?.hasClass(HIDDEN)).toBe(false);
		expect(panels.text?.hasClass(HIDDEN)).toBe(true);
	});
});
