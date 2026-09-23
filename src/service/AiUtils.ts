import { AVAILABLE_PROVIDERS } from '../config/AiProviderConfig';
import { AiProvider } from '../models/AiProvider';

export function parseModel(model: string): { provider: AiProvider; modelId: string } {
    const slashIndex = model.indexOf('/');
    if (slashIndex === -1) {
        throw new Error(`Invalid model format: ${model}. Expected provider/model`);
    }
    const providerName = model.slice(0, slashIndex);

    const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerName);

    if (!provider)
        throw new Error(`Unknown provider name: ${providerName}.
        Please, use one of the next: ${AVAILABLE_PROVIDERS.map(p => p.id).join(', ')}.`);

    const modelId = model.slice(slashIndex + 1);

    return { provider, modelId };
}

export async function* readSseLines(response: Response): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) yield line;
    }

    buffer += decoder.decode();

    for (const line of buffer.split('\n')) yield line;
}

export function parseSsePayload(line: string): unknown | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) return null;

    try {
        return JSON.parse(trimmed.slice(6));
    } catch {
        return null;
    }
}
