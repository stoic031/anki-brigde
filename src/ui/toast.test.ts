import { beforeEach, describe, expect, it, vi } from 'vitest';

const { Notice } = vi.hoisted(() => ({ Notice: vi.fn() }));
vi.mock('obsidian', () => ({ Notice }));

import { toastError, toastSuccess } from './toast';

beforeEach(() => {
	Notice.mockClear();
});

describe('toastSuccess', () => {
	it('shows a Notice for 3000ms', () => {
		toastSuccess('✅ Note synced to Anki!');

		expect(Notice).toHaveBeenCalledWith('✅ Note synced to Anki!', 3000);
	});
});

describe('toastError', () => {
	it('shows a Notice for 5000ms', () => {
		toastError('❌ Failed to sync. Please check Anki connection.');

		expect(Notice).toHaveBeenCalledWith(
			'❌ Failed to sync. Please check Anki connection.',
			5000,
		);
	});
});
