import AiModel from "../models/AiModel";
import Message from "../models/message";

import { fetchMistralResponse, fetchMistralStream, fetchModelInfo } from "./MistralService";

import { Dispatch, SetStateAction } from "react";
import { getEncoding } from "js-tiktoken";

const enc = getEncoding("cl100k_base");

const GENERATE_CHAT_NAME_SYSTEM_PROMPT =
    'Generate a concise chat title (max 40 chars) based on the user\'s message. ' +
    'The title must be in the SAME LANGUAGE as the user\'s text. ' +
    'Be specific and descriptive. No quotes or formatting. Output title only.\n\n' +
    'User: [message]\nTitle:';

export async function generateChatTitle(message: string) {
    const prompt = GENERATE_CHAT_NAME_SYSTEM_PROMPT.replace('[message]', message);

    const systemMessage: Message = {
        id: crypto.randomUUID(),
        content: prompt,
        sender: 'system',
    };

    try {
        let title = await fetchMistralResponse([systemMessage]);
        const cleanTitle = title.trim().replace(/^["']|["']$/g, '');

        return cleanTitle;
    } catch (error) {
        throw new Error('Error generating chat title: ' + error);
    }
}

async function trimMessagesToFitContext(messages: Message[]): Promise<Message[]> {
    let resultMessages = [...messages];
    let modelInfo = await getModelInfo();
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
    setMessages: Dispatch<SetStateAction<Message[]>>
): Promise<string> {
    const contextTrimmedMessages = await trimMessagesToFitContext(messages);

    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: Message = {
        id: assistantMessageId,
        content: 'working...',
        sender: 'assistant',
    };

    setMessages(prev => [...prev, assistantMessage]);


    let messageContent = '';

    try {
        for await (const chunk of fetchMistralStream(contextTrimmedMessages)) {
            messageContent += chunk;
            setMessages(prev => prev.map(
                msg => msg.id === assistantMessageId ? { ...msg, content: messageContent } : msg
            ));
        }

        return messageContent;
    } catch (error) {
        const errorMsg = (error as Error).message;
        setMessages(prev => prev.map(
            msg => msg.id === assistantMessageId ? { ...msg, content: errorMsg } : msg
        ));
        throw error;
    }
}



async function getModelInfo(): Promise<AiModel> {
    let modelInfo = localStorage.getItem('modelInfo');

    if (!modelInfo) {
        let fetchedModelInfo = await fetchModelInfo();
        localStorage.setItem('modelInfo', JSON.stringify(fetchedModelInfo));
        modelInfo = JSON.stringify(fetchedModelInfo);
    }

    return JSON.parse(modelInfo);
}