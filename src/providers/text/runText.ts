import { ProviderError } from '../../types';
import type { TextContext, TextResult, TextTask } from '../types';
import { parseTextResult } from './parseResult';
import { buildMessages, resultKeys } from './prompt';

// Sends the prompt and parses the reply; a malformed reply is retried once (spec §2.4).
// Transport errors (timeout, HTTP) are not retried — the user's endpoint is the problem.
export async function runText(
	providerId: string,
	input: string,
	task: TextTask,
	targetFields: string[],
	complete: (system: string, user: string) => Promise<string>,
	context?: TextContext,
): Promise<TextResult> {
	const { system, user } = buildMessages(input, task, targetFields, context);
	const keys = resultKeys(task, targetFields);
	let lastError: ProviderError | undefined;
	for (let attempt = 0; attempt < 2; attempt++) {
		const reply = await complete(system, user);
		try {
			return parseTextResult(providerId, reply, keys);
		} catch (err) {
			if (!(err instanceof ProviderError)) throw err;
			lastError = err;
		}
	}
	throw lastError as ProviderError;
}
