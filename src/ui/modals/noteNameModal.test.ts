import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeButtonComponent {
	text = '';
	cta = false;
	private clickCb: (() => unknown) | null = null;

	setButtonText(t: string) {
		this.text = t;
		return this;
	}
	setCta() {
		this.cta = true;
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

class FakeTextComponent {
	inputEl = {
		addEventListener: (
			event: string,
			cb: (evt: { key: string }) => unknown,
		) => {
			modalState.domEventHandlers.push({ event, cb });
		},
	};
	private changeCb: ((value: string) => unknown) | null = null;

	onChange(cb: (value: string) => unknown) {
		this.changeCb = cb;
		return this;
	}
	async triggerChange(value: string) {
		await this.changeCb?.(value);
	}
}

class FakeSetting {
	buttonComponents: FakeButtonComponent[] = [];
	textComponents: FakeTextComponent[] = [];

	constructor(public containerEl: unknown) {}
	addButton(cb: (b: FakeButtonComponent) => unknown) {
		const button = new FakeButtonComponent();
		cb(button);
		this.buttonComponents.push(button);
		return this;
	}
	addText(cb: (t: FakeTextComponent) => unknown) {
		const text = new FakeTextComponent();
		cb(text);
		this.textComponents.push(text);
		return this;
	}
}

const { settings, modalState } = vi.hoisted(() => ({
	settings: [] as FakeSetting[],
	modalState: {
		title: '',
		closeCalled: false,
		domEventHandlers: [] as {
			event: string;
			cb: (evt: { key: string }) => unknown;
		}[],
	},
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
		contentEl = { empty: vi.fn() };
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

import { NoteNameModal } from './noteNameModal';

describe('NoteNameModal', () => {
	beforeEach(() => {
		settings.length = 0;
		modalState.title = '';
		modalState.closeCalled = false;
		modalState.domEventHandlers = [];
	});

	function openModal(onSubmit: (name: string | null) => void) {
		const modal = new NoteNameModal({} as never, onSubmit);
		modal.onOpen();
		return modal;
	}

	it('sets the title and renders a text field plus Cancel/Create buttons', () => {
		openModal(vi.fn());

		expect(modalState.title).toBe('Enter note name:');
		expect(settings[0]?.textComponents).toHaveLength(1);
		expect(settings[1]?.buttonComponents.map((b) => b.text)).toEqual([
			'Cancel',
			'Create',
		]);
		expect(settings[1]?.buttonComponents[1]?.cta).toBe(true);
	});

	it('submits the typed name when Create is clicked', async () => {
		const onSubmit = vi.fn();
		openModal(onSubmit);

		await settings[0]?.textComponents[0]?.triggerChange('薬');
		await settings[1]?.buttonComponents[1]?.triggerClick();

		expect(modalState.closeCalled).toBe(true);
		expect(onSubmit).toHaveBeenCalledExactlyOnceWith('薬');
	});

	it('submits the typed name when Enter is pressed in the text field', async () => {
		const onSubmit = vi.fn();
		openModal(onSubmit);

		await settings[0]?.textComponents[0]?.triggerChange('診察');
		const keydown = modalState.domEventHandlers.find(
			(h) => h.event === 'keydown',
		);
		await keydown?.cb({ key: 'Enter' });

		expect(onSubmit).toHaveBeenCalledExactlyOnceWith('診察');
	});

	it('ignores non-Enter keys in the text field', async () => {
		const onSubmit = vi.fn();
		openModal(onSubmit);

		const keydown = modalState.domEventHandlers.find(
			(h) => h.event === 'keydown',
		);
		await keydown?.cb({ key: 'a' });

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('submits null when Cancel is clicked, without a second call on close', () => {
		const onSubmit = vi.fn();
		const modal = openModal(onSubmit);

		void settings[1]?.buttonComponents[0]?.triggerClick();
		modal.onClose();

		expect(onSubmit).toHaveBeenCalledExactlyOnceWith(null);
	});

	it('submits null on close when nothing was submitted (Escape/click-outside)', () => {
		const onSubmit = vi.fn();
		const modal = openModal(onSubmit);

		modal.onClose();

		expect(onSubmit).toHaveBeenCalledExactlyOnceWith(null);
	});

	it('does not call onSubmit again on close after Create already submitted', async () => {
		const onSubmit = vi.fn();
		const modal = openModal(onSubmit);

		await settings[1]?.buttonComponents[1]?.triggerClick();
		modal.onClose();

		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
});
