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

export async function generateChatTitle(message: string, model: string) {
    const prompt = GENERATE_CHAT_NAME_SYSTEM_PROMPT.replace('[message]', message);

    const systemMessage: Message = {
        id: crypto.randomUUID(),
        content: prompt,
        sender: 'system',
    };

    try {
        let title = await fetchMistralResponse([systemMessage], model);
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
        for await (const chunk of fetchMistralStream(contextTrimmedMessages, model)) {
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



async function getModelInfo(model: string): Promise<AiModel> {
    let modelInfo = localStorage.getItem('modelInfo');

    if (!modelInfo) {
        let fetchedModelInfo = await fetchModelInfo(model);
        localStorage.setItem('modelInfo', JSON.stringify(fetchedModelInfo));
        modelInfo = JSON.stringify(fetchedModelInfo);
    }

    return JSON.parse(modelInfo);
}