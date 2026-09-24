import type { MarkdownPostProcessorContext } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { resolveAnkiConnectUrl } from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';

const MIME: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
};
// Media filenames as buildMediaFilename writes them — no path, scheme or query.
const BARE_NAME = /^[^/\\:?#]+\.[a-z0-9]+$/i;
const OFFLINE_TITLE = 'Image is in Anki — start Anki to show it';

export interface AnkiImageDeps {
	retrieve: (filename: string) => Promise<string | false>;
	isVaultFile: (src: string, sourcePath: string) => boolean;
}

// docs/design/03-note.md §3.2 — Add image stores the file in Anki only (never the vault),
// so an <img src="name.png"> in the note is broken in Obsidian. At render time, read the
// file back from Anki and swap in a data: URL; nothing is written anywhere.
// ponytail: unbounded in-memory cache per session; switch to an LRU if many large
// images ever matter.
export function createAnkiImageProcessor(deps: AnkiImageDeps) {
	const cache = new Map<string, Promise<string | null>>();

	const load = (name: string): Promise<string | null> => {
		let hit = cache.get(name);
		if (!hit) {
			hit = deps.retrieve(name).then(
				(b64) => {
					if (b64 === false || !b64) return null;
					const ext = name.split('.').pop()?.toLowerCase() ?? '';
					return `data:${MIME[ext] ?? `image/${ext}`};base64,${b64}`;
				},
				() => null,
			);
			// Failures aren't cached, so the next render retries (Anki may be up by then).
			void hit.then((url) => {
				if (url === null) cache.delete(name);
			});
			cache.set(name, hit);
		}
		return hit;
	};

	return async (
		el: HTMLElement,
		ctx: Pick<MarkdownPostProcessorContext, 'frontmatter' | 'sourcePath'>,
	): Promise<void> => {
		// Only Anki notes — every other note in the vault is left alone.
		const fm = ctx.frontmatter as Record<string, unknown> | undefined;
		if (!fm?.anki_deck) return;

		const jobs = Array.from(el.querySelectorAll('img')).map(async (img) => {
			const src = img.getAttribute('src') ?? '';
			if (!BARE_NAME.test(src) || deps.isVaultFile(src, ctx.sourcePath))
				return;
			const url = await load(src);
			if (url) img.setAttribute('src', url);
			else img.setAttribute('title', OFFLINE_TITLE);
		});
		await Promise.all(jobs);
	};
}

export function registerAnkiImages(plugin: AnkiBridgePlugin): void {
	plugin.registerMarkdownPostProcessor(
		createAnkiImageProcessor({
			retrieve: (name) =>
				new AnkiConnectClient(
					resolveAnkiConnectUrl(plugin.settings),
				).retrieveMediaFile(name),
			isVaultFile: (src, sourcePath) =>
				plugin.app.metadataCache.getFirstLinkpathDest(
					src,
					sourcePath,
				) !== null,
		}),
	);
}
