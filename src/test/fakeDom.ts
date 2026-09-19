// Minimal stand-in for the slice of Obsidian's HTMLElement augmentations the sidebar
// uses (createDiv/createEl/createSpan/setText/toggleClass/...), so view code can be
// tested without a DOM.
interface CreateOpts {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string>;
}

export class FakeEl {
	classes = new Set<string>();
	text = '';
	attrs: Record<string, string> = {};
	children: FakeEl[] = [];
	disabled = false;
	hidden = false;
	private listeners: Record<string, (() => unknown)[]> = {};

	constructor(
		public tag = 'div',
		opts: CreateOpts = {},
	) {
		for (const c of ([] as string[]).concat(opts.cls ?? [])) this.classes.add(c);
		this.text = opts.text ?? '';
		this.attrs = { ...opts.attr };
	}

	createEl(tag: string, opts: CreateOpts = {}): FakeEl {
		const el = new FakeEl(tag, opts);
		this.children.push(el);
		return el;
	}
	createDiv(opts: CreateOpts = {}): FakeEl {
		return this.createEl('div', opts);
	}
	createSpan(opts: CreateOpts = {}): FakeEl {
		return this.createEl('span', opts);
	}
	setText(text: string): void {
		this.text = text;
	}
	setAttr(name: string, value: string): void {
		this.attrs[name] = value;
	}
	empty(): void {
		this.children = [];
	}
	toggleClass(cls: string, on: boolean): void {
		if (on) this.classes.add(cls);
		else this.classes.delete(cls);
	}
	hasClass(cls: string): boolean {
		return this.classes.has(cls);
	}
	addEventListener(event: string, cb: () => unknown): void {
		(this.listeners[event] ??= []).push(cb);
	}
	// Fires the click listeners and waits for anything they kick off synchronously.
	async click(): Promise<void> {
		await Promise.all((this.listeners.click ?? []).map((cb) => cb()));
	}

	// Depth-first search over this element and its descendants.
	findAll(pred: (el: FakeEl) => boolean): FakeEl[] {
		return [
			...(pred(this) ? [this] : []),
			...this.children.flatMap((c) => c.findAll(pred)),
		];
	}
	byClass(cls: string): FakeEl[] {
		return this.findAll((el) => el.hasClass(cls));
	}
}
