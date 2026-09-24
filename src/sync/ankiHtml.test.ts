import { describe, expect, it } from 'vitest';
import { ankiHtmlToMarkdown } from './ankiHtml';

describe('ankiHtmlToMarkdown', () => {
	it('turns <br> variants into newlines', () => {
		expect(ankiHtmlToMarkdown('a<br>b<br/>c<BR />d')).toBe('a\nb\nc\nd');
	});

	it('turns divs into line breaks and collapses blank runs', () => {
		expect(ankiHtmlToMarkdown('<div>a</div><div>b</div>')).toBe('a\n\nb');
	});

	it('decodes common entities, &amp; last', () => {
		expect(
			ankiHtmlToMarkdown(
				'a&nbsp;&lt;b&gt; &quot;c&quot; &#39;d&#39; &amp;lt;',
			),
		).toBe('a <b> "c" \'d\' &lt;');
	});

	it('keeps sound and img tags and other inline HTML', () => {
		expect(ankiHtmlToMarkdown('[sound:a.mp3]')).toBe('[sound:a.mp3]');
		expect(ankiHtmlToMarkdown('<img src="x.png">')).toBe(
			'<img src="x.png">',
		);
		expect(ankiHtmlToMarkdown('<b>bold</b>')).toBe('<b>bold</b>');
	});
});
