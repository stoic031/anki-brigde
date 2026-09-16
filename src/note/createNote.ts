import { Notice } from 'obsidian';
import { sanitizeForFilename } from './mediaNaming';
import { generateContentSkeleton } from './contentTemplate';
import {
	getUniqueNotePath,
	openPluginSettings,
	resolveQuickCaptureTarget,
} from './quickCapture';
import { resolveAnkiConnectUrl } from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { writeAnkiFrontmatter } from '../sync/parser';
import { toastError } from '../ui/toast';
import { revealSidebarView } from '../ui/sidebarView';
import { NoteNameModal } from '../ui/modals/noteNameModal';
import type AnkiBridgePlugin from '../main';

// docs/design/07-sidebar.md §7.3 — Ribbon icon / "Anki: Create new note" command.
// Deck/Model/Folder resolution reuses resolveQuickCaptureTarget: despite its name,
// it's the general §7.3 step [2] 3-way resolution, already shared with the hotkey
// flow (docs/design/03-note.md §3.7 step 4).
export async function runCreateNote(plugin: AnkiBridgePlugin): Promise<void> {
	const target = resolveQuickCaptureTarget(plugin.settings);
	if (!target) {
		new Notice(
			'Please configure Deck, Model, and Save location in Settings first',
		);
		openPluginSettings(plugin.app, plugin.manifest.id);
		return;
	}

	if (target.seededFromDefaults) {
		plugin.settings.currentDeck = target.deck;
		plugin.settings.currentModel = target.model;
		await plugin.saveSettings();
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

		const filename = `${sanitizeForFilename(name)}.md`;
		const path = getUniqueNotePath(plugin.app, target.folder, filename);
		const content = generateContentSkeleton(fields);

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
