import AiModel from "../models/AiModel";
import Message from "../models/message";
import { BaseClient } from "./BaseClient";


export function createGeminiService(): BaseClient {
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

    return {
        async getModelInfo(model: string): Promise<AiModel> {
            const apiKey = getApiKey();

            const response = await fetch(
                `${GEMINI_API_URL}/models/${model}?key=${apiKey}`
            );

            await checkErrorResponse(response);

            const data = await response.json();
            return {
                id: data.name.replace('models/', ''),
                name: data.displayName,
                context: data.inputTokenLimit
            };
        },
        async generateResponse(messages: Message[], model: string): Promise<string> {
            const response = await fetchChatRequest(messages, model, false);

            await checkErrorResponse(response);

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
                    if (!line.startsWith('data: ')) continue;

                    const json = JSON.parse(line.slice(6));
                    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;

                    if (content) {
                        yield content;
                    }
                }
            }
        }
    }

    async function fetchChatRequest(messages: Message[], model: string, streaming: boolean): Promise<Response> {
        const apiKey = getApiKey();

        const url = streaming
            ? `${GEMINI_API_URL}/models/${model}:streamGenerateContent?alt=sse`
            : `${GEMINI_API_URL}/models/${model}:generateContent`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
                contents: toGeminiFormat(messages)
            })
        });

        return response;
    }

    function getApiKey(): string {
        const apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            throw new Error('Gemini API key not found');
        }
        return apiKey;
    }

    function toGeminiFormat(messages: Message[]) {
        return messages.map((msg) => ({
            role: msg.sender === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
    }

    async function checkErrorResponse(response: Response) {
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API ${response.status}: ${errorText}`);
        }
    }
}