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

import { ConfirmModal, DELETE_COPY, REBUILD_COPY } from './confirm';

describe.each([DELETE_COPY, REBUILD_COPY])('ConfirmModal: $button', (copy) => {
	beforeEach(() => {
		settings.length = 0;
		modalState.title = '';
		modalState.texts = [];
		modalState.closeCalled = false;
	});

	function openModal(onConfirm: () => void) {
		const modal = new ConfirmModal({} as never, copy, onConfirm);
		modal.onOpen();
		return modal;
	}

	it('sets the title and body copy', () => {
		openModal(vi.fn());

		expect(modalState.title).toBe(copy.title);
		expect(modalState.texts).toContain(copy.text);
	});

	it('renders Cancel and a warning-styled confirm button', () => {
		openModal(vi.fn());

		const [buttons] = settings.map((s) => s.buttonComponents);
		expect(buttons?.map((b) => b.text)).toEqual(['Cancel', copy.button]);
		expect(buttons?.[1]?.warning).toBe(true);
	});

	it('closes without calling onConfirm when Cancel is clicked', async () => {
		const onConfirm = vi.fn();
		openModal(onConfirm);

		const [cancel] = settings[0]?.buttonComponents ?? [];
		await cancel?.triggerClick();

		expect(modalState.closeCalled).toBe(true);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('closes and calls onConfirm when the confirm button is clicked', async () => {
		const onConfirm = vi.fn();
		openModal(onConfirm);

		const [, del] = settings[0]?.buttonComponents ?? [];
		await del?.triggerClick();

		expect(modalState.closeCalled).toBe(true);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it('empties contentEl on close', () => {
		const modal = openModal(vi.fn());
		modal.onClose();
		expect(modalState.texts).toEqual([]);
	});
});
