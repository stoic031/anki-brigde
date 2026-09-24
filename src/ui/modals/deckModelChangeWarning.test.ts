import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeButtonComponent {
	text = '';
	warning = false;
	private clickCb: (() => unknown) | null = null;

	setButtonText(t: string) {
		this.text = t;
		return this;
	}
	setWarning() {
		this.warning = true;
		return this;
	}
	onClick(cb: () => unknown) {
		this.clickCb = cb;
		return this;
	}
	async triggerClick() {
		await this.clickCb?.();
	}
}

class FakeSetting {
	buttonComponents: FakeButtonComponent[] = [];

	constructor(public containerEl: unknown) {}
	addButton(cb: (b: FakeButtonComponent) => unknown) {
		const button = new FakeButtonComponent();
		cb(button);
		this.buttonComponents.push(button);
		return this;
	}
}

const { settings, modalState } = vi.hoisted(() => ({
	settings: [] as FakeSetting[],
	modalState: { title: '', texts: [] as string[], closeCalled: false },
}));

vi.mock('obsidian', () => ({
	Setting: class {
		constructor(containerEl: unknown) {
			const s = new FakeSetting(containerEl);
			settings.push(s);
			return s;
		}
	},
	Modal: class {
		app: unknown;
		contentEl = {
			createEl: (_tag: string, opts?: { text?: string }) => {
				if (opts?.text) modalState.texts.push(opts.text);
				return {};
			},
			empty: () => {
				modalState.texts.length = 0;
			},
		};
		constructor(app: unknown) {
			this.app = app;
		}
		setTitle(title: string) {
			modalState.title = title;
			return this;
		}
		close() {
			modalState.closeCalled = true;
		}
	},
}));

import { DeckModelChangeWarningModal } from './deckModelChangeWarning';

describe('DeckModelChangeWarningModal', () => {
	beforeEach(() => {
		settings.length = 0;
		modalState.title = '';
		modalState.texts = [];
		modalState.closeCalled = false;
	});

	function openModal(onKeepOld: () => void, onUpdate: () => void) {
		const modal = new DeckModelChangeWarningModal(
			{} as never,
			onKeepOld,
			onUpdate,
		);
		modal.onOpen();
		return modal;
	}

	it('sets the title and body copy', () => {
		openModal(vi.fn(), vi.fn());

		expect(modalState.title).toBe('Change Deck/Model for this note?');
		expect(modalState.texts).toContain(
			'This note is already synced to Anki under a different Deck/Model. Updating will create a new note in Anki the next time you sync.',
		);
	});

	it('renders Keep old and a warning-styled Update button, in that order', () => {
		openModal(vi.fn(), vi.fn());

		const [buttons] = settings.map((s) => s.buttonComponents);
		expect(buttons?.map((b) => b.text)).toEqual(['Keep old', 'Update']);
		expect(buttons?.[0]?.warning).toBe(false);
		expect(buttons?.[1]?.warning).toBe(true);
	});

	it('closes and calls onKeepOld, not onUpdate, when Keep old is clicked', async () => {
		const onKeepOld = vi.fn();
		const onUpdate = vi.fn();
		openModal(onKeepOld, onUpdate);

		const [keepOld] = settings[0]?.buttonComponents ?? [];
		await keepOld?.triggerClick();

		expect(modalState.closeCalled).toBe(true);
		expect(onKeepOld).toHaveBeenCalledTimes(1);
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('closes and calls onUpdate, not onKeepOld, when Update is clicked', async () => {
		const onKeepOld = vi.fn();
		const onUpdate = vi.fn();
		openModal(onKeepOld, onUpdate);

		const [, update] = settings[0]?.buttonComponents ?? [];
		await update?.triggerClick();

		expect(modalState.closeCalled).toBe(true);
		expect(onUpdate).toHaveBeenCalledTimes(1);
		expect(onKeepOld).not.toHaveBeenCalled();
	});

	it('empties contentEl on close', () => {
		const modal = openModal(vi.fn(), vi.fn());
		modal.onClose();
		expect(modalState.texts).toEqual([]);
	});
});
