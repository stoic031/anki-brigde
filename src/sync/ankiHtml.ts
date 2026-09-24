const ENTITIES: Record<string, string> = {
	'&nbsp;': ' ',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&amp;': '&', // last, so "&amp;lt;" becomes "&lt;", not "<"
};

// docs/design/01-sync.md §1.3 — basic Anki field HTML → Markdown for pulling. Line breaks
// and common entities only; [sound:], <img> and any other tag stay (Obsidian renders HTML).
export function ankiHtmlToMarkdown(html: string): string {
	let text = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/?div[^>]*>/gi, '\n');
	for (const [entity, char] of Object.entries(ENTITIES))
		text = text.split(entity).join(char);
	return text.replace(/\n{3,}/g, '\n\n').trim();
}
