import type AnkiBridgePlugin from '../../main';
import { resolveAnkiConnectUrl } from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { toastError } from '../toast';

// A model's field names for the sidebar tabs; null (after a toast) when Anki can't answer.
export async function loadFields(
	plugin: AnkiBridgePlugin,
	model: string,
): Promise<string[] | null> {
	try {
		return await new AnkiConnectClient(
			resolveAnkiConnectUrl(plugin.settings),
		).modelFieldNames(model);
	} catch {
		toastError('❌ Failed to load fields. Please check Anki connection.');
		return null;
	}
}
