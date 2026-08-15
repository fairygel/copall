import { AVAILABLE_PROVIDERS } from '../config/AiProviderConfig';
import { AiProvider } from '../models/AiProvider';

export function parseModel(model: string): { provider: AiProvider; modelId: string } {
    const slashIndex = model.indexOf('/');
    if (slashIndex === -1) {
        throw new Error(`Invalid model format: ${model}. Expected provider/model`);
    }
    const providerName = model.slice(0, slashIndex);

    const provider = AVAILABLE_PROVIDERS.find(p => p.name === providerName);

    if (!provider)
        throw new Error(`Unknown provider name: ${providerName}.
        Please, use one of the next: ${AVAILABLE_PROVIDERS.map(p => p.name).join(', ')}.`);

    const modelId = model.slice(slashIndex + 1);

    return { provider, modelId };
}

export async function* parseStreamResponse(
    response: Response,
    extractor: (json: any) => string | undefined | null
): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line === 'data: [DONE]') {
                return;
            }
            if (!line.startsWith('data: ')) continue;

            try {
                const json = JSON.parse(line.slice(6));
                const content = extractor(json);

                if (content) {
                    yield content;
                }
            } catch (e) {
                // Ignore parse errors for incomplete or non-JSON stream lines
            }
        }
    }
}
