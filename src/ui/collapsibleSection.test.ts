import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeEl } from '../test/fakeDom';

const { setIcon } = vi.hoisted(() => ({ setIcon: vi.fn() }));
vi.mock('obsidian', () => ({ setIcon }));

import { renderCollapsibleSection } from './collapsibleSection';

afterEach(() => {
	vi.clearAllMocks();
});

function details(parent: FakeEl): FakeEl {
	const el = parent.children[0];
	if (!el) throw new Error('expected a <details> element');
	return el;
}

describe('renderCollapsibleSection', () => {
	it('opens by default when defaultOpen is true', () => {
		const parent = new FakeEl();

		renderCollapsibleSection(
			parent as unknown as HTMLElement,
			'General',
			true,
		);

		const el = details(parent);
		expect(el.tag).toBe('details');
		expect(el.classes.has('vocabweave-settings__section')).toBe(true);
		expect(el.attrs.open).toBe('');
	});

	it('is collapsed by default when defaultOpen is false', () => {
		const parent = new FakeEl();

		renderCollapsibleSection(
			parent as unknown as HTMLElement,
			'Advanced',
			false,
		);

		expect(details(parent).attrs.open).toBeUndefined();
	});

	it('shows the title in the summary, with a chevron icon', () => {
		const parent = new FakeEl();

		renderCollapsibleSection(
			parent as unknown as HTMLElement,
			'AI providers',
			false,
		);

		const summary = details(parent).children[0];
		expect(summary?.tag).toBe('summary');
		expect(summary?.children.some((c) => c.text === 'AI providers')).toBe(
			true,
		);
		expect(setIcon).toHaveBeenCalledWith(
			expect.anything(),
			'chevron-right',
		);
	});

	it('returns a body element nested inside the details, for the caller to render into', () => {
		const parent = new FakeEl();

		const body = renderCollapsibleSection(
			parent as unknown as HTMLElement,
			'General',
			true,
		) as unknown as FakeEl;
		body.createDiv({ text: 'a field' });

		const el = details(parent);
		expect(el.classes.has('vocabweave-settings__section')).toBe(true);
		// body is the details' second child (after summary) and now holds what the
		// caller rendered into it.
		expect(el.children[1]).toBe(body);
		expect(body.children[0]?.text).toBe('a field');
	});
});
