import Message from '../models/message';
import { parseModel } from './AiUtils';

import { createClient } from './ClientProviderFactory';
import type { ChatOptions } from './ai-client/BaseClient';

import { Dispatch, SetStateAction } from 'react';
import { getEncoding } from 'js-tiktoken';
import { getModelFromCatalog } from './CatalogService';

const enc = getEncoding('cl100k_base');

const IMAGE_TOKEN_ESTIMATE = 1500;

function countTokens(messages: Message[]): number {
    const text = JSON.stringify(
        messages.map(msg => ({
            role: msg.sender,
            content: msg.content,
            images: msg.attachments?.length ?? 0,
        }))
    );

    let tokens = enc.encode(text).length;

    for (const msg of messages) {
        tokens += (msg.attachments?.length ?? 0) * IMAGE_TOKEN_ESTIMATE;
    }

    return tokens;
}

const GENERATE_CHAT_NAME_SYSTEM_PROMPT =
    "Generate a concise chat title (max 40 chars) based on the user's message. " +
    "The title must be in the SAME LANGUAGE as the user's text. " +
    'Be specific and descriptive. No quotes or formatting. Output title only.';

export async function generateChatTitle(message: string, model: string) {
    const systemMessage: Message = {
        id: crypto.randomUUID(),
        content: GENERATE_CHAT_NAME_SYSTEM_PROMPT,
        sender: 'system',
        createdAt: Date.now(),
    };

    const userMessage: Message = {
        id: crypto.randomUUID(),
        content: message,
        sender: 'user',
        createdAt: Date.now(),
    };

    const { provider, modelId } = parseModel(model);
    const client = createClient(provider);

    try {
        const title = await client.generateResponse([systemMessage, userMessage], modelId);
        const cleanTitle = title.trim().replace(/^["']|["']$/g, '');

        return cleanTitle;
    } catch (error) {
        throw new Error('Error generating chat title: ' + error);
    }
}

async function trimMessagesToFitContext(messages: Message[], model: string): Promise<Message[]> {
    let resultMessages = [...messages];
    let modelInfo = await getModelFromCatalog(model);
    let contextLimit = modelInfo.context;

    if (!contextLimit || contextLimit <= 0) {
        return resultMessages;
    }

    let messageTokens = countTokens(resultMessages);

    let safeContextLimit = contextLimit - contextLimit * 0.1;

    while (messageTokens > safeContextLimit) {
        const oldestNonSystem = resultMessages.findIndex(msg => msg.sender !== 'system');

        if (oldestNonSystem === -1) break;

        resultMessages.splice(oldestNonSystem, 1);
        messageTokens = countTokens(resultMessages);
    }

    if (resultMessages.length === 0 || messageTokens > safeContextLimit) {
        throw new Error('The most recent message exceeds the model context limit.');
    }

    return resultMessages;
}

export async function generateAssistantResponse(
    messages: Message[],
    model: string,
    setMessages: Dispatch<SetStateAction<Message[]>>,
    options?: ChatOptions
): Promise<string> {
    const { provider, modelId } = parseModel(model);
    const contextTrimmedMessages = await trimMessagesToFitContext(messages, model);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: Message = {
        id: assistantMessageId,
        content: 'working...',
        sender: 'assistant',
        createdAt: Date.now(),
    };

    setMessages(prev => [...prev, assistantMessage]);

    let messageContent = '';
    let lastFlush = 0;

    try {
        const client = createClient(provider);
        const stream = client.generateStream(contextTrimmedMessages, modelId, options);

        for await (const chunk of stream) {
            messageContent += chunk;

            const now = performance.now();

            if (now - lastFlush < 120) continue;

            lastFlush = now;

            const snapshot = messageContent;

            setMessages(prev =>
                prev.map(msg =>
                    msg.id === assistantMessageId ? { ...msg, content: snapshot } : msg
                )
            );
        }

        const finalContent = messageContent;

        setMessages(prev =>
            prev.map(msg =>
                msg.id === assistantMessageId ? { ...msg, content: finalContent } : msg
            )
        );

        return messageContent;
    } catch (error) {
        const errorMsg = (error as Error).message;
        const failedContent = messageContent;

        setMessages(prev =>
            prev.map(msg =>
                msg.id === assistantMessageId
                    ? { ...msg, content: failedContent + '\n' + errorMsg }
                    : msg
            )
        );
        throw error;
    }
}
