import { Setting, type DropdownComponent } from 'obsidian';
import type AnkiBridgePlugin from '../../main';
import { fieldConfigKey, resolveAnkiConnectUrl } from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { toastError } from '../toast';

export interface MainFieldControl {
	// Called whenever the active note's Deck+Model may have changed. Only re-fetches
	// the field list when the pair actually differs from what is rendered.
	sync(deck: string, model: string): Promise<void>;
}

// docs/design/07-sidebar.md §7.2.1 — Main Field dropdown, right below Model. Like the
// Text/Image tabs (not like Deck/Model), its value is a setting saved per Deck+Model
// pair, not read from the active note's frontmatter.
export function renderMainFieldDropdown(
	parent: HTMLElement,
	plugin: AnkiBridgePlugin,
	// Lets the sidebar force the Text tab to re-read the new value immediately,
	// without waiting for a note/pair switch (its own sync() is deduped by pair).
	onChange: () => void,
): MainFieldControl {
	let dropdown: DropdownComponent | undefined;
	let renderedKey = '';

	new Setting(parent).setName('Main field').addDropdown((d) => {
		dropdown = d;
	});

	return {
		async sync(deck, model) {
			const key = fieldConfigKey(deck, model);
			if (key === renderedKey) return;
			renderedKey = key;
			if (!dropdown) return;

			dropdown.selectEl.empty();
			if (!deck || !model) {
				dropdown.addOption('', 'Not set');
				dropdown.setValue('');
				dropdown.setDisabled(true);
				return;
			}

			let fields: string[];
			try {
				const client = new AnkiConnectClient(
					resolveAnkiConnectUrl(plugin.settings),
				);
				fields = await client.modelFieldNames(model);
			} catch {
				toastError(
					'❌ Failed to load fields. Please check Anki connection.',
				);
				return;
			}
			// The note changed while fields were loading — a newer sync owns the dropdown.
			if (renderedKey !== key) return;

			const saved = plugin.settings.mainFieldConfig[key] ?? '';
			dropdown.addOption('', 'Select a field');
			for (const field of fields) dropdown.addOption(field, field);
			dropdown.setValue(fields.includes(saved) ? saved : '');
			dropdown.setDisabled(false);
			dropdown.onChange(async (value) => {
				plugin.settings.mainFieldConfig[key] = value;
				await plugin.saveSettings();
				onChange();
			});
		},
	};
}
