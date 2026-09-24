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

import { SyncConflictModal } from './syncConflict';

describe('SyncConflictModal', () => {
	beforeEach(() => {
		settings.length = 0;
		modalState.title = '';
		modalState.texts = [];
		modalState.closeCalled = false;
	});

	function openModal(onChoice: (c: unknown) => void) {
		const modal = new SyncConflictModal({} as never, onChoice);
		modal.onOpen();
		return modal;
	}

	it('sets the title and body copy', () => {
		openModal(vi.fn());
		expect(modalState.title).toBe('Note changed in Anki');
		expect(modalState.texts).toContain(
			'This note was edited in Anki since the last sync. Which version do you want to keep?',
		);
	});

	it('renders Cancel, Use Anki version and a warning-styled Keep Obsidian version', () => {
		openModal(vi.fn());
		const buttons = settings[0]?.buttonComponents ?? [];
		expect(buttons.map((b) => b.text)).toEqual([
			'Cancel',
			'Use Anki version',
			'Keep Obsidian version',
		]);
		expect(buttons[2]?.warning).toBe(true);
	});

	it.each([
		[0, null],
		[1, 'anki'],
		[2, 'obsidian'],
	])(
		'button %i closes and reports %s exactly once',
		async (index, choice) => {
			const onChoice = vi.fn();
			const modal = openModal(onChoice);
			await settings[0]?.buttonComponents[index]?.triggerClick();
			modal.onClose(); // Obsidian calls onClose after close()
			expect(modalState.closeCalled).toBe(true);
			expect(onChoice).toHaveBeenCalledTimes(1);
			expect(onChoice).toHaveBeenCalledWith(choice);
		},
	);

	it('reports a cancel when closed without choosing', () => {
		const onChoice = vi.fn();
		openModal(onChoice).onClose();
		expect(onChoice).toHaveBeenCalledWith(null);
	});
});
