import AiModel from "../models/AiModel";
import { AiProvider } from "../models/AiProvider";
import Message from "../models/message";
import { getApiKey } from "../config/AiProviderConfig";
import { BaseClient } from "./BaseClient";
import { parseStreamResponse } from "./AiUtils";

export function createOpenAIClient(provider: AiProvider): BaseClient {
    return {
        async getModelInfo(model: string): Promise<AiModel> {
            const apiKey = getApiKey(provider);
            if (!apiKey) throw new Error(`For getting model info, ${provider.name}ApiKey is required.`)

            const response = await fetch(provider.baseUrl + `/v1/models/${model}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            await checkErrorResponse(response);

            const data = await response.json();
            return {
                id: `${provider.name}/${data.id}`,
                name: data.name,
                context: data.max_context_length,
                provider
            };
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

            yield* parseStreamResponse(
                response,
                (json) => json.choices?.[0]?.delta?.content
            );
        },

        async getAvailableModels(provider: AiProvider) {
            const apiKey = getApiKey(provider);
            if (!apiKey) return [];

            try {
                const response = await fetch(provider.baseUrl + `/v1/models`, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });

                await checkErrorResponse(response);

                const data = await response.json();
                console.log(`[${provider.name}] models response:`, data);

                const items = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.data)
                        ? data.data
                        : [];

                return items.map((model: any) => ({
                    id: `${provider.name}/${model.id}`,
                    name: model.id ?? model.name,
                    context: model.max_context_length ?? 0,
                    provider
                }));
            } catch (error) {
                console.error(`Failed to load models for ${provider.name}:`, error);
                return [];
            }
        }
    };

    async function fetchChatRequest(messages: Message[], model: string, streaming: boolean): Promise<Response> {
        const apiKey = getApiKey(provider);
        if (!apiKey) throw new Error(`For chatting, ${provider.name}ApiKey is required.`)

        const response = await fetch(provider.baseUrl + '/v1/chat/completions', {
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

    function toMistralFormat(messages: Message[]) {
        return messages.map((msg) => ({
            role: msg.sender,
            content: msg.content
        }));
    }

    async function checkErrorResponse(response: Response) {
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API - ${response.status}: ${errorText}`);
        }
    }
}

