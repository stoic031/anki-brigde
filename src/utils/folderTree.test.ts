import { describe, expect, it } from 'vitest';
import { buildFolderTreeEntries } from './folderTree';

interface FakeFolder {
	path: string;
	name: string;
	parent: FakeFolder | null;
}

function fakeFolder(path: string, parent: FakeFolder | null = null): FakeFolder {
	return {
		path,
		name: path.split('/').pop() ?? path,
		parent,
	};
}

// Matches folderTree.ts's own INDENT constant (2 NBSP per depth level).
const INDENT = '  ';

describe('buildFolderTreeEntries', () => {
	it('indents nested folders by depth and labels each with only its own name', () => {
		const japanese = fakeFolder('Japanese');
		const n2 = fakeFolder('Japanese/N2', japanese);
		const vocab = fakeFolder('Japanese/N2/Vocab', n2);

		const entries = buildFolderTreeEntries([japanese, n2, vocab] as never);

		expect(entries).toEqual([
			{ value: 'Japanese', label: 'Japanese' },
			{ value: 'Japanese/N2', label: `${INDENT}N2` },
			{ value: 'Japanese/N2/Vocab', label: `${INDENT}${INDENT}Vocab` },
		]);
	});

	it('walks the tree depth-first: each folder immediately followed by its own children', () => {
		const japanese = fakeFolder('Japanese');
		const n2 = fakeFolder('Japanese/N2', japanese);
		const vocab = fakeFolder('Japanese/N2/Vocab', n2);
		const korean = fakeFolder('Korean');

		// Deliberately out of order, as returned from the vault.
		const entries = buildFolderTreeEntries([korean, vocab, japanese, n2] as never);

		expect(entries.map((e) => e.value)).toEqual([
			'Japanese',
			'Japanese/N2',
			'Japanese/N2/Vocab',
			'Korean',
		]);
	});

	it('sorts sibling folders by their own name, not full path', () => {
		const japanese = fakeFolder('Japanese');
		const zebra = fakeFolder('Japanese/Zebra', japanese);
		const apple = fakeFolder('Japanese/Apple', japanese);

		const entries = buildFolderTreeEntries([japanese, zebra, apple] as never);

		expect(entries.map((e) => e.value)).toEqual([
			'Japanese',
			'Japanese/Apple',
			'Japanese/Zebra',
		]);
	});

	it('does not let a sibling folder wedge between a parent and its own child (path-string sort bug)', () => {
		// "Japanese Advanced" (space, 0x20) sorts before "Japanese/N2" (slash, 0x2F)
		// under plain path-string comparison, even though Japanese/N2 is a child of
		// the unrelated "Japanese" folder. Grouping by actual TFolder.parent (not path
		// strings) must keep Japanese/N2 directly under Japanese regardless of what
		// other top-level folders exist.
		const japanese = fakeFolder('Japanese');
		const japaneseAdvanced = fakeFolder('Japanese Advanced');
		const n2 = fakeFolder('Japanese/N2', japanese);

		const entries = buildFolderTreeEntries([japaneseAdvanced, japanese, n2] as never);

		expect(entries.map((e) => e.value)).toEqual([
			'Japanese',
			'Japanese/N2',
			'Japanese Advanced',
		]);
	});

	it('returns an empty list for an empty folder list', () => {
		expect(buildFolderTreeEntries([])).toEqual([]);
	});
});
