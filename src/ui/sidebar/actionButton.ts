import { setIcon } from 'obsidian';
import { AnkiConnectError, ProviderError, SyncError } from '../../types';
import { toastError } from '../toast';

export interface ActionButton {
	el: HTMLButtonElement;
	label: HTMLElement;
	idleLabel: string;
	// True while runAction() is cycling — state updates must not re-enable it mid-flight.
	busy: boolean;
}

// Icon (Obsidian's built-in Lucide set) + text, styled by styles.css.
export function createActionButton(
	parent: HTMLElement,
	opts: { icon: string; label: string; variant?: 'primary' | 'danger' },
): ActionButton {
	const cls = ['anki-bridge-sidebar__action'];
	if (opts.variant) cls.push(`anki-bridge-sidebar__action--${opts.variant}`);
	const el = parent.createEl('button', { cls, attr: { type: 'button' } });
	setIcon(el.createSpan({ cls: 'anki-bridge-sidebar__action-icon' }), opts.icon);
	const label = el.createSpan({ text: opts.label });
	return { el, label, idleLabel: opts.label, busy: false };
}

// .claude/rules/ui-copy.md button states: normal → ⏳ (disabled) → ✅ Done! (2s) or
// ❌ Error (3s) → normal. `hideOnSuccess` is for actions that are no longer applicable
// afterwards (Delete): the button goes back to normal but stays hidden.
export async function runAction(
	button: ActionButton,
	opts: {
		work: () => Promise<void>;
		failure: string;
		onRestore: () => void;
		hideOnSuccess?: boolean;
		busyLabel?: string;
	},
): Promise<void> {
	const restore = () => {
		button.busy = false;
		button.label.setText(button.idleLabel);
		button.el.disabled = false;
		opts.onRestore();
	};

	button.busy = true;
	button.el.disabled = true;
	button.label.setText(opts.busyLabel ?? '⏳ Processing...');
	try {
		await opts.work();
		if (opts.hideOnSuccess) {
			restore();
			button.el.hidden = true;
			return;
		}
		button.label.setText('✅ Done!');
		window.setTimeout(restore, 2000);
	} catch (err) {
		// SyncError already carries a case-specific message (docs/design/01-sync.md §1.6);
		// show it instead of the generic copy so "model not found" doesn't read as
		// "Anki is down". ProviderError likewise names the provider and URL that failed.
		// AnkiConnectError reaches here bare when it's a real AnkiConnect error that
		// toSyncError() didn't recognize (syncEngine.ts) — its own message still beats
		// the generic fallback, which would otherwise misreport a real error as
		// "check Anki connection" while Anki is actually reachable.
		toastError(
			err instanceof SyncError ||
				err instanceof ProviderError ||
				err instanceof AnkiConnectError
				? `❌ ${err.message}`
				: opts.failure,
		);
		button.label.setText('❌ Error');
		window.setTimeout(restore, 3000);
	}
}
