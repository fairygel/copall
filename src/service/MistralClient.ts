import AiModel from "../models/AiModel";
import Message from "../models/message";
import { BaseClient } from "./BaseClient";

export function createMistralService(): BaseClient {
    const MISTRAL_API_URL = 'https://api.mistral.ai/v1';

    return {
        async getModelInfo(model: string): Promise<AiModel> {
            const apiKey = getApiKey();

            const response = await fetch(MISTRAL_API_URL + `/models/${model}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            await checkErrorResponse(response);

            const data = await response.json();
            return { id: data.id, name: data.name, context: data.max_context_length };
        },

        async generateResponse(messages: Message[], model: string): Promise<string> {
            const response = await fetchChatRequest(messages, model, false);

            await checkErrorResponse(response);

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        },

        async *generateStream(messages: Message[], model: string): AsyncGenerator<string> {
            const response = await fetchChatRequest(messages, model, true);

            await checkErrorResponse(response);

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

                    const json = JSON.parse(line.slice(6));
                    const content = json.choices?.[0]?.delta?.content;

                    if (content) {
                        yield content;
                    }
                }
            }
        }
    };

    async function fetchChatRequest(messages: Message[], model: string, streaming: boolean): Promise<Response> {
        let apiKey = getApiKey();

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: toMistralFormat(messages),
                stream: streaming,
            })
        });

        return response;
    }

    function getApiKey(): string {
        const apiKey = localStorage.getItem('mistralApiKey');
        if (!apiKey) {
            throw new Error('API key not found');
        }
        return apiKey;
    }

    function toMistralFormat(messages: Message[]) {
        return messages.map((msg) => ({
            role: msg.sender,
            content: msg.content
        }));
    }

    async function checkErrorResponse(response: Response) {
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Mistral API ${response.status}: ${errorText}`);
        }
    }
}

