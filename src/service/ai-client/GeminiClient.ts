import { getApiKey } from '../../config/AiProviderConfig';
import { AiProvider } from '../../models/AiProvider';
import Message from '../../models/message';
import { parseStreamResponse } from '../AiUtils';
import { BaseClient } from './BaseClient';

export function createGeminiService(provider: AiProvider): BaseClient {
    return {
        async generateResponse(messages: Message[], model: string): Promise<string> {
            const response = await fetchChatRequest(messages, model, false);

            await checkErrorResponse(response);

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        },
        async *generateStream(messages: Message[], model: string): AsyncGenerator<string> {
            const response = await fetchChatRequest(messages, model, true);

            await checkErrorResponse(response);

            yield* parseStreamResponse(
                response,
                json => json.candidates?.[0]?.content?.parts?.[0]?.text
            );
        },
    };

    async function fetchChatRequest(
        messages: Message[],
        model: string,
        streaming: boolean
    ): Promise<Response> {
        const apiKey = getApiKey(provider);

        const url = streaming
            ? `${provider.baseUrl}/models/${model}:streamGenerateContent?alt=sse`
            : `${provider.baseUrl}/models/${model}:generateContent`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: toGeminiFormat(messages),
            }),
        });

        return response;
    }

    function toGeminiFormat(messages: Message[]) {
        return messages.map(msg => ({
            role: msg.sender === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));
    }

    async function checkErrorResponse(response: Response) {
        if (!response.ok) {
            const err = await response.json();
            throw new Error(
                `Gemini API - ${response.status}: ${err.error?.message || err.message || err.toString()}`
            );
        }
    }
}
