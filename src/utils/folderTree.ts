import type { TFolder } from 'obsidian';

export interface FolderTreeEntry {
	value: string;
	label: string;
}

// Groups folders by their actual TFolder.parent (not by comparing path strings) and
// walks the tree depth-first, so a sibling folder can never get visually wedged
// between a parent and its own child — e.g. "Japanese Advanced" (space, 0x20) sorts
// before "Japanese/N2" (slash, 0x2F) in plain path-string comparison even though
// Japanese/N2 is a child of the unrelated "Japanese" folder. Labels show only each
// folder's own name, indented per depth, so deep hierarchies stay readable; value is
// still the full path. Shared by src/ui/sidebarView.ts and src/ui/settingsTab.ts —
// both render a "Save notes to" folder dropdown and must stay visually consistent.
export function buildFolderTreeEntries(folders: TFolder[]): FolderTreeEntry[] {
	const byParent = new Map<string, TFolder[]>();
	for (const folder of folders) {
		const parentPath = folder.parent?.path ?? '';
		const siblings = byParent.get(parentPath) ?? [];
		siblings.push(folder);
		byParent.set(parentPath, siblings);
	}
	for (const siblings of byParent.values()) {
		siblings.sort((a, b) => a.name.localeCompare(b.name));
	}

	const INDENT = '  '; // NBSP x2 per depth — plain spaces collapse in <option> text
	const entries: FolderTreeEntry[] = [];
	const walk = (parentPath: string, depth: number) => {
		for (const folder of byParent.get(parentPath) ?? []) {
			entries.push({
				value: folder.path,
				label: INDENT.repeat(depth) + folder.name,
			});
			walk(folder.path, depth + 1);
		}
	};
	walk('', 0);
	return entries;
}
