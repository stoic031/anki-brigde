import { Notice, Setting, type Events } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import {
	getActiveProfile,
	resolveAnkiConnectUrl,
	type Profile,
} from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { PROFILE_CHANGED_EVENT } from '../utils/constants';
import { buildFolderTreeEntries } from '../utils/folderTree';

export interface ProfilesSection {
	// Fills the Deck/Model pickers with Anki's names; ignored after dispose().
	setAnkiNames(deckNames: string[], modelNames: string[]): void;
	dispose(): void;
}

// docs/design/06-settings.md §6.1 — profile selector + editor for the active profile.
// Re-renders when the sidebar (or anything else) fires PROFILE_CHANGED_EVENT.
export function renderProfilesSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): ProfilesSection {
	const el = containerEl.createDiv({ cls: 'anki-bridge-settings__profiles' });
	let names: { decks: string[]; models: string[] } | null = null;
	let disposed = false;
	// Main field options depend on the active profile's Model — fetched lazily and
	// cached by model name (dedup, self-corrects if the model changes again while a
	// fetch is in flight; see the check before renderPicker below).
	let mainFields: string[] = [];
	let mainFieldsModel = '';
	let mainFieldsLoading = false;

	const render = (): void => {
		el.empty();
		const { settings } = plugin;
		const active = getActiveProfile(settings);

		new Setting(el)
			.setName('Profile')
			.setDesc(
				'Used when you create a new note or capture a selection. Also selectable in the sidebar.',
			)
			.addDropdown((dropdown) => {
				for (const p of settings.profiles)
					dropdown.addOption(p.id, p.name);
				dropdown
					.setValue(active.id)
					.onChange((id) => void plugin.setActiveProfile(id));
			})
			.addButton((button) =>
				button.setButtonText('Add').onClick(() => {
					const profile: Profile = {
						id: crypto.randomUUID(),
						name: uniqueName(settings.profiles, 'New profile'),
						deck: '',
						model: '',
						folder: '',
						mainField: '',
						targetLanguage: '',
					};
					settings.profiles.push(profile);
					void plugin.setActiveProfile(profile.id);
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('Delete')
					.setWarning()
					.setDisabled(settings.profiles.length <= 1)
					.onClick(() => {
						settings.profiles = settings.profiles.filter(
							(p) => p.id !== active.id,
						);
						void plugin.setActiveProfile(
							settings.profiles[0]?.id ?? '',
						);
					}),
			);

		new Setting(el).setName('Profile name').addText((text) => {
			text.setValue(active.name);
			// 'change' fires on blur/enter, so re-rendering doesn't steal focus mid-typing.
			text.inputEl.addEventListener('change', () => {
				const value = text.getValue().trim();
				const taken = settings.profiles.some(
					(p) => p.id !== active.id && p.name === value,
				);
				if (value === '' || taken) {
					new Notice(
						value === ''
							? '❌ Profile name cannot be empty.'
							: '❌ A profile with that name already exists. Please choose another.',
					);
					text.setValue(active.name);
					return;
				}
				active.name = value;
				void plugin.setActiveProfile(active.id);
			});
		});

		// Always shown: before Anki's names are loaded (or when it's offline) they list
		// only the saved value, so the profile's Deck/Model stay visible.
		renderPicker(el, 'Deck', names?.decks ?? [], active.deck, async (v) => {
			active.deck = v;
			await plugin.saveSettings();
		});
		renderPicker(
			el,
			'Model',
			names?.models ?? [],
			active.model,
			async (v) => {
				active.model = v;
				await plugin.saveSettings();
			},
		);

		if (
			active.model &&
			active.model !== mainFieldsModel &&
			!mainFieldsLoading
		) {
			void loadMainFields(active.model);
		}
		renderPicker(
			el,
			'Main field',
			active.model && mainFieldsModel === active.model ? mainFields : [],
			active.mainField,
			async (v) => {
				active.mainField = v;
				await plugin.saveSettings();
			},
		);

		new Setting(el).setName('Learning language').addText((text) => {
			text.setPlaceholder('E.g. Japanese').setValue(
				active.targetLanguage,
			);
			text.inputEl.addEventListener('change', () => {
				active.targetLanguage = text.getValue().trim();
				void plugin.saveSettings();
			});
		});

		renderFolderPicker(el, plugin, active);
	};

	// docs/design/06-settings.md §6.1 — Main field options depend on the profile's
	// Model, fetched from AnkiConnect same as Deck/Model names. Silent on failure,
	// same convention as loadAnkiNames() in settingsTab.ts — the picker just keeps
	// showing the saved value.
	const loadMainFields = async (model: string): Promise<void> => {
		mainFieldsLoading = true;
		try {
			const client = new AnkiConnectClient(
				resolveAnkiConnectUrl(plugin.settings),
			);
			const fields = await client.modelFieldNames(model);
			if (disposed) return;
			mainFields = fields;
			mainFieldsModel = model;
			render();
		} catch {
			// Anki offline: keep showing the saved Main field value.
		} finally {
			mainFieldsLoading = false;
		}
	};

	render();
	// Workspace's typed overloads don't know custom event names; Events' generic one does.
	const workspaceEvents: Events = plugin.app.workspace;
	const ref = workspaceEvents.on(PROFILE_CHANGED_EVENT, render);

	return {
		setAnkiNames(decks, models) {
			if (disposed) return;
			names = { decks, models };
			render();
		},
		dispose: () => {
			disposed = true;
			workspaceEvents.offref(ref);
		},
	};
}

function uniqueName(profiles: Profile[], base: string): string {
	let name = base;
	for (let n = 2; profiles.some((p) => p.name === name); n++) {
		name = `${base} ${n}`;
	}
	return name;
}

function renderPicker(
	el: HTMLElement,
	label: string,
	options: string[],
	current: string,
	onChange: (value: string) => Promise<void>,
): void {
	new Setting(el).setName(label).addDropdown((dropdown) => {
		dropdown.addOption('', `Select ${label.toLowerCase()}…`);
		for (const name of options) dropdown.addOption(name, name);
		// A saved value Anki doesn't list (deleted, or names not loaded) still shows.
		if (current && !options.includes(current)) {
			dropdown.addOption(current, current);
		}
		dropdown.setValue(current).onChange((value) => void onChange(value));
	});
}

// Doesn't depend on AnkiConnect, so it's always visible (no Connect gating).
function renderFolderPicker(
	el: HTMLElement,
	plugin: AnkiBridgePlugin,
	profile: Profile,
): void {
	new Setting(el).setName('Save notes to').addDropdown((dropdown) => {
		const folders = plugin.app.vault
			.getAllFolders(true)
			.filter((folder) => !folder.isRoot());
		for (const { value, label } of [
			{ value: '', label: '/ (vault root)' },
			...buildFolderTreeEntries(folders),
		]) {
			dropdown.addOption(value, label);
		}
		if (folders.some((folder) => folder.path === profile.folder)) {
			dropdown.setValue(profile.folder);
		}
		dropdown.onChange(async (value) => {
			profile.folder = value;
			await plugin.saveSettings();
		});
	});
}
