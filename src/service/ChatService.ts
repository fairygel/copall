import AiModel from "../models/AiModel";
import Message from "../models/message";

import { createClient } from "./ClientProviderFactory";

import { Dispatch, SetStateAction } from "react";
import { getEncoding } from "js-tiktoken";

const enc = getEncoding("cl100k_base");

const GENERATE_CHAT_NAME_SYSTEM_PROMPT =
    'Generate a concise chat title (max 40 chars) based on the user\'s message. ' +
    'The title must be in the SAME LANGUAGE as the user\'s text. ' +
    'Be specific and descriptive. No quotes or formatting. Output title only.\n\n' +
    'User: [message]\nTitle:';

type Provider = 'mistral' | 'google';

function parseModel(model: string): { provider: Provider; modelId: string } {
    const slashIndex = model.indexOf('/');
    if (slashIndex === -1) {
        throw new Error(`Invalid model format: ${model}. Expected provider/model`);
    }
    const provider = model.slice(0, slashIndex) as Provider;
    const modelId = model.slice(slashIndex + 1);

    if (provider !== 'mistral' && provider !== 'google') {
        throw new Error(`Unknown provider: ${provider}`);
    }

    return { provider, modelId };
}

export async function generateChatTitle(message: string, model: string) {
    const prompt = GENERATE_CHAT_NAME_SYSTEM_PROMPT.replace('[message]', message);

    const systemMessage: Message = {
        id: crypto.randomUUID(),
        content: prompt,
        sender: 'system',
    };

    const { modelId } = parseModel(model);
    const client = createClient(model);

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
    const { modelId } = parseModel(model);
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
        const client = createClient(model);
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

async function getModelInfo(model: string): Promise<AiModel> {
    const { provider, modelId } = parseModel(model);
    const cacheKey = `modelInfo_${provider}_${modelId}`;

    let modelInfo = localStorage.getItem(cacheKey);

    if (!modelInfo) {
        const client = createClient(model);
        let fetchedModelInfo = await client.getModelInfo(modelId);
        localStorage.setItem(cacheKey, JSON.stringify(fetchedModelInfo));
        modelInfo = JSON.stringify(fetchedModelInfo);
    }

    return JSON.parse(modelInfo);
}