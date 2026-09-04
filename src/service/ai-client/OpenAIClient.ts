import { AiProvider } from '../../models/AiProvider';
import Message from '../../models/message';
import { getApiKey } from '../../config/AiProviderConfig';
import { BaseClient } from './BaseClient';
import { parseStreamResponse } from '../AiUtils';

export function createOpenAIClient(provider: AiProvider): BaseClient {
    return {
        async generateResponse(messages: Message[], model: string): Promise<string> {
            const response = await fetchChatRequest(messages, model, false);

            await checkErrorResponse(response);

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        },

        async *generateStream(messages: Message[], model: string): AsyncGenerator<string> {
            const response = await fetchChatRequest(messages, model, true);

            await checkErrorResponse(response);

            yield* parseStreamResponse(response, json => json.choices?.[0]?.delta?.content);
        },
    };

    async function fetchChatRequest(
        messages: Message[],
        model: string,
        streaming: boolean
    ): Promise<Response> {
        const apiKey = getApiKey(provider);
        if (!apiKey) throw new Error(`For chatting, ${provider.name}ApiKey is required.`);

        const response = await fetch(provider.baseUrl + '/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: toChatFormat(messages),
                stream: streaming,
            }),
        });

        return response;
    }

    function toChatFormat(messages: Message[]) {
        return messages.map(msg => ({
            role: msg.sender,
            content: msg.content,
        }));
    }

    async function checkErrorResponse(response: Response) {
        if (!response.ok) {
            let details = '';
            try {
                const err = await response.json();
                details = err.error?.message || err.message || JSON.stringify(err);
            } catch {
                try {
                    details = await response.text();
                } catch {
                    details = response.statusText;
                }
            }
            throw new Error(`OpenAI API - ${response.status}: ${details || response.statusText}`);
        }
    }
}
