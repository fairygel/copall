import AiModel from "../models/AiModel";
import Message from "../models/message";
import { parseModel } from "./AiUtils";

import { createClient } from "./ClientProviderFactory";
import { AVAILABLE_PROVIDERS, getApiKey } from "../config/AiProviderConfig";

import { Dispatch, SetStateAction } from "react";
import { getEncoding } from "js-tiktoken";
import { queryClient } from "../storage/queryClient";

const enc = getEncoding("cl100k_base");

const GENERATE_CHAT_NAME_SYSTEM_PROMPT =
    'Generate a concise chat title (max 40 chars) based on the user\'s message. ' +
    'The title must be in the SAME LANGUAGE as the user\'s text. ' +
    'Be specific and descriptive. No quotes or formatting. Output title only.\n\n' +
    'User: [message]\nTitle:';

export async function generateChatTitle(message: string, model: string) {
    const prompt = GENERATE_CHAT_NAME_SYSTEM_PROMPT.replace('[message]', message);

    const systemMessage: Message = {
        id: crypto.randomUUID(),
        content: prompt,
        sender: 'system',
    };

    const { provider, modelId } = parseModel(model);
    const client = createClient(provider);

    try {
        const title = await client.generateResponse([systemMessage], modelId);
        const cleanTitle = title.trim().replace(/^["']|["']$/g, '');

        return cleanTitle;
    } catch (error) {
        throw new Error('Error generating chat title: ' + error);
    }
}

async function trimMessagesToFitContext(messages: Message[], model: string): Promise<Message[]> {
    let resultMessages = [...messages];
    let modelInfo = await getModelInfo(model);
    let contextLimit = modelInfo.context;

    let messageTokens = enc.encode(JSON.stringify(resultMessages)).length;

    // Reserve 10% of the context for safety
    let safeContextLimit = contextLimit - contextLimit * 0.1;

    while (messageTokens > safeContextLimit && resultMessages.length > 0) {
        resultMessages = resultMessages.slice(1);
        messageTokens = enc.encode(JSON.stringify(resultMessages)).length;
    }

    return resultMessages;
}

export async function generateAssistantResponse(
    messages: Message[],
    model: string,
    setMessages: Dispatch<SetStateAction<Message[]>>
): Promise<string> {
    const { provider, modelId } = parseModel(model);
    const contextTrimmedMessages = await trimMessagesToFitContext(messages, model);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: Message = {
        id: assistantMessageId,
        content: 'working...',
        sender: 'assistant',
    };

    setMessages(prev => [...prev, assistantMessage]);

    let messageContent = '';

    try {
        const client = createClient(provider);
        const stream = client.generateStream(contextTrimmedMessages, modelId);

        for await (const chunk of stream) {
            messageContent += chunk;
            setMessages(prev => prev.map(
                msg => msg.id === assistantMessageId ? { ...msg, content: messageContent } : msg
            ));
        }

        return messageContent;
    } catch (error) {
        const errorMsg = (error as Error).message;
        setMessages(prev => prev.map(
            msg => msg.id === assistantMessageId ? { ...msg, content: messageContent + '\n' + errorMsg } : msg
        ));
        throw error;
    }
}

export async function getAvailableModels(): Promise<AiModel[]> {
    const providersWithKeys = AVAILABLE_PROVIDERS.filter(provider => !!getApiKey(provider));

    const results = await Promise.allSettled(
        providersWithKeys.map(async (provider) => {
            const client = createClient(provider);
            return await client.getAvailableModels(provider);
        })
    );

    const models: AiModel[] = [];
    for (const result of results) {
        if (result.status === 'fulfilled') {
            models.push(...result.value);
        } else {
            console.error('Failed to load models for provider:', result.reason);
        }
    }

    return models;
}

async function getModelInfo(model: string): Promise<AiModel> {
    const cachedModels = queryClient.getQueryData<AiModel[]>(['ai-models-list']);
    
    const found = cachedModels?.find(m => m.id === model);
    if (found) {
        return found;
    } else {
        throw new Error(`Model ${model} not found in storage.`);
    }
}