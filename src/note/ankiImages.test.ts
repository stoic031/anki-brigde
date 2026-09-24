import { describe, expect, it, vi } from 'vitest';
import { createAnkiImageProcessor } from './ankiImages';

vi.mock('obsidian', () => ({}));

class FakeImg {
	attrs: Record<string, string>;
	constructor(src: string) {
		this.attrs = { src };
	}
	getAttribute(name: string): string | null {
		return this.attrs[name] ?? null;
	}
	setAttribute(name: string, value: string): void {
		this.attrs[name] = value;
	}
}

const container = (...imgs: FakeImg[]) =>
	({ querySelectorAll: () => imgs }) as unknown as HTMLElement;
const anki = { frontmatter: { anki_deck: 'D' }, sourcePath: 'n.md' };

function setup(retrieve = vi.fn().mockResolvedValue('AQID')) {
	const isVaultFile = vi.fn((src: string) => src === 'in-vault.png');
	return { retrieve, run: createAnkiImageProcessor({ retrieve, isVaultFile }) };
}

describe('Anki image post-processor', () => {
	it('swaps a bare media filename for a data URL, fetching it once', async () => {
		const { retrieve, run } = setup();
		const a = new FakeImg('_x_image_1.jpg');
		await run(container(a), anki);
		expect(a.attrs.src).toBe('data:image/jpeg;base64,AQID');

		const b = new FakeImg('_x_image_1.jpg');
		await run(container(b), anki);
		expect(b.attrs.src).toBe('data:image/jpeg;base64,AQID');
		expect(retrieve).toHaveBeenCalledTimes(1);
	});

	it('ignores notes that are not Anki notes', async () => {
		const { retrieve, run } = setup();
		await run(container(new FakeImg('a.png')), { frontmatter: {}, sourcePath: 'n.md' });
		await run(container(new FakeImg('a.png')), { frontmatter: undefined, sourcePath: 'n.md' });
		expect(retrieve).not.toHaveBeenCalled();
	});

	it('leaves URLs, paths and vault files alone', async () => {
		const { retrieve, run } = setup();
		const imgs = ['https://x.org/a.png', 'img/a.png', 'app://a.png', 'in-vault.png'].map(
			(s) => new FakeImg(s),
		);
		await run(container(...imgs), anki);
		expect(retrieve).not.toHaveBeenCalled();
		expect(imgs.map((i) => i.attrs.src)).toEqual([
			'https://x.org/a.png',
			'img/a.png',
			'app://a.png',
			'in-vault.png',
		]);
	});

	it('keeps the src and hints when Anki is offline, then retries on the next render', async () => {
		const retrieve = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce('AQID');
		const { run } = setup(retrieve);

		const a = new FakeImg('a.png');
		await run(container(a), anki);
		expect(a.attrs.src).toBe('a.png');
		expect(a.attrs.title).toMatch(/start Anki/);

		await run(container(new FakeImg('a.png')), anki); // file missing → still broken
		const c = new FakeImg('a.png');
		await run(container(c), anki);
		expect(c.attrs.src).toBe('data:image/png;base64,AQID');
		expect(retrieve).toHaveBeenCalledTimes(3);
	});
});
