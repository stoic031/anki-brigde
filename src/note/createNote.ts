import { Notice } from 'obsidian';
import { getUniqueNotePath, noteFilename } from './noteName';
import { generateContentSkeleton } from './contentTemplate';
import {
	openPluginSettings,
	resolveMainField,
	resolveQuickCaptureTarget,
} from './quickCapture';
import { resolveAnkiConnectUrl } from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { writeAnkiFrontmatter } from '../sync/parser';
import { toastError } from '../ui/toast';
import { revealSidebarView } from '../ui/sidebarView';
import { NoteNameModal } from '../ui/modals/noteNameModal';
import type VocabWeavePlugin from '../main';

// docs/design/07-sidebar.md §7.3 — Ribbon icon / "Anki: Create new note" command.
// Deck/Model/Folder come from the active profile via resolveQuickCaptureTarget,
// shared with the hotkey flow (docs/design/03-note.md §3.7 step 4).
export async function runCreateNote(plugin: VocabWeavePlugin): Promise<void> {
	const target = resolveQuickCaptureTarget(plugin.settings);
	if (!target) {
		new Notice('Please set up a profile in settings first');
		openPluginSettings(plugin.app, plugin.manifest.id);
		return;
	}

	const name = await new Promise<string | null>((resolve) => {
		new NoteNameModal(plugin.app, resolve).open();
	});
	if (name === null) return;

	try {
		const client = new AnkiConnectClient(
			resolveAnkiConnectUrl(plugin.settings),
		);
		const fields = await client.modelFieldNames(target.model);

		const filename = `${noteFilename(name)}.md`;
		const path = getUniqueNotePath(plugin.app, target.folder, filename);
		// Main Field isn't required here — a fresh Deck+Model pair has no note open
		// yet to have configured it from (docs/design/03-note.md §3.6/§3.7). Falls
		// back to the profile's Main Field default and seeds it for this pair.
		const mainField = await resolveMainField(plugin, target);
		const content = generateContentSkeleton(
			fields,
			mainField ? { field: mainField, content: name } : undefined,
		);

		const file = await plugin.app.vault.create(path, content);
		await writeAnkiFrontmatter(plugin.app, file, {
			anki_deck: target.deck,
			anki_model: target.model,
		});
		await plugin.app.workspace.getLeaf(false).openFile(file);
		await revealSidebarView(plugin.app);
	} catch {
		toastError('❌ Failed to create note. Please check Anki connection.');
	}
}
