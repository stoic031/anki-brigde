import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { Notice, notices } = vi.hoisted(() => {
	const notices: {
		setMessage: ReturnType<typeof vi.fn>;
		hide: ReturnType<typeof vi.fn>;
	}[] = [];
	const Notice = vi.fn(function (this: unknown, message: string) {
		const n = { message, setMessage: vi.fn(), hide: vi.fn() };
		notices.push(n);
		return n;
	});
	return { Notice, notices };
});
vi.mock('obsidian', () => ({ Notice }));

import { startProgressNotice } from './progressNotice';

beforeEach(() => {
	Notice.mockClear();
	notices.length = 0;
	// startProgressNotice ticks with window.setInterval; Node has no `window`.
	vi.stubGlobal('window', globalThis);
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('startProgressNotice', () => {
	it('shows the initial message with no elapsed suffix', () => {
		startProgressNotice('⏳ Asking the text model…');

		expect(Notice).toHaveBeenCalledWith('⏳ Asking the text model…', 0);
		expect(notices[0]?.setMessage).not.toHaveBeenCalled();
	});

	it('ticks an elapsed-seconds suffix onto the current message every second', () => {
		startProgressNotice('⏳ Asking the text model…');

		vi.advanceTimersByTime(1000);
		expect(notices[0]?.setMessage).toHaveBeenLastCalledWith(
			'⏳ Asking the text model… (1s)',
		);

		vi.advanceTimersByTime(1000);
		expect(notices[0]?.setMessage).toHaveBeenLastCalledWith(
			'⏳ Asking the text model… (2s)',
		);
	});

	it('update() changes the base text without resetting the elapsed counter', () => {
		const progress = startProgressNotice('⏳ Asking the text model…');

		vi.advanceTimersByTime(2000);
		progress.update('⏳ Generating the image…');
		vi.advanceTimersByTime(1000);

		expect(notices[0]?.setMessage).toHaveBeenLastCalledWith(
			'⏳ Generating the image… (3s)',
		);
	});

	it('stop() clears the interval and hides the notice', () => {
		const progress = startProgressNotice('⏳ Asking the text model…');

		progress.stop();
		expect(notices[0]?.hide).toHaveBeenCalledTimes(1);

		const callsBefore = notices[0]?.setMessage.mock.calls.length;
		vi.advanceTimersByTime(5000);
		expect(notices[0]?.setMessage.mock.calls.length).toBe(callsBefore);
	});
});
