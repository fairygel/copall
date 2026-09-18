import { AiProvider } from '../../models/AiProvider';
import Message from '../../models/message';
import { getApiKey } from '../../config/AiProviderConfig';
import {
    BaseClient,
    MAX_SEARCHES,
    MAX_TOOL_ROUNDS,
    PAGE_TOOL_DESCRIPTION,
    PAGE_TOOL_NAME,
    PAGE_TOOL_SCHEMA,
    SEARCH_SYSTEM_PROMPT,
    SEARCH_TOOL_DESCRIPTION,
    SEARCH_TOOL_NAME,
    SEARCH_TOOL_SCHEMA,
} from './BaseClient';
import {
    fetchPageContent,
    formatPageContent,
    formatSearchResults,
    searchWeb,
} from '../SearchService';
import { parseSsePayload, readSseLines } from '../AiUtils';

const SEARCH_TOOL = {
    type: 'function',
    function: {
        name: SEARCH_TOOL_NAME,
        description: SEARCH_TOOL_DESCRIPTION,
        parameters: SEARCH_TOOL_SCHEMA,
    },
};

const PAGE_TOOL = {
    type: 'function',
    function: {
        name: PAGE_TOOL_NAME,
        description: PAGE_TOOL_DESCRIPTION,
        parameters: PAGE_TOOL_SCHEMA,
    },
};

type ChatMsg = { role: string; content?: unknown; [key: string]: unknown };

type ToolAction =
    | { kind: 'search'; callId: string; query: string }
    | { kind: 'page'; callId: string; url: string };

interface StreamSummary {
    assistantMsg: ChatMsg | null;
    actions: ToolAction[];
}

export function createOpenAIClient(provider: AiProvider): BaseClient {
    return {
        async generateResponse(messages: Message[], model: string): Promise<string> {
            const response = await fetchChatRequest(toChatFormat(messages), model, false);

            await checkErrorResponse(response);

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        },

        async *generateStream(messages: Message[], model: string): AsyncGenerator<string> {
            const history: ChatMsg[] = withSearchPrompt(toChatFormat(messages));
            let searchesUsed = 0;

            for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
                const response = await fetchChatRequest(history, model, true);

                await checkErrorResponse(response);

                const summary: StreamSummary = yield* readOpenAiSse(response);

                if (summary.assistantMsg) history.push(summary.assistantMsg);

                if (summary.actions.length === 0 || round === MAX_TOOL_ROUNDS) return;

                const [first, ...rest] = summary.actions;

                for (const skipped of rest) {
                    history.push({
                        role: 'tool',
                        tool_call_id: skipped.callId,
                        content:
                            'Only one tool call is allowed per step. ' +
                            'Wait for the other result, then ' +
                            're-issue this call alone if still needed.',
                    });
                }

                if (first.kind === 'search') {
                    if (searchesUsed >= MAX_SEARCHES) {
                        history.push({
                            role: 'tool',
                            tool_call_id: first.callId,
                            content:
                                `Search limit reached (${MAX_SEARCHES} per message). ` +
                                'Open one of the URLs from the results you already have ' +
                                'with open_page, or answer from what you have.',
                        });
                        continue;
                    }

                    const query = first.query.trim().slice(0, 400);

                    if (!query) {
                        history.push({
                            role: 'tool',
                            tool_call_id: first.callId,
                            content: 'Empty search query, ask the user to clarify.',
                        });
                        continue;
                    }

                    searchesUsed += 1;

                    yield `\n\n> [search] Searching the web: ${query}\n\n`;

                    history.push(await runSearch(first.callId, query));
                } else {
                    const url = first.url.trim();

                    if (!url) {
                        history.push({
                            role: 'tool',
                            tool_call_id: first.callId,
                            content: 'Empty page URL, use an exact URL from search results.',
                        });
                        continue;
                    }

                    yield `\n\n> [search] Opening page: ${url}\n\n`;

                    history.push(await runOpenPage(first.callId, url));
                }
            }
        },
    };

    async function runSearch(callId: string, query: string): Promise<ChatMsg> {
        let content: string;

        try {
            content = formatSearchResults(query, await searchWeb(query));
        } catch (e) {
            content =
                `Web search failed (${(e as Error).message}). ` +
                'Answer from your own knowledge and warn that it may be outdated.';
        }

        return { role: 'tool', tool_call_id: callId, content };
    }

    async function runOpenPage(callId: string, url: string): Promise<ChatMsg> {
        let content: string;

        try {
            content = formatPageContent(await fetchPageContent(url));
        } catch (e) {
            content =
                `Page open failed (${(e as Error).message}). ` +
                'Answer from the search snippets you already have.';
        }

        return { role: 'tool', tool_call_id: callId, content };
    }

    async function fetchChatRequest(
        history: ChatMsg[],
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
                messages: history,
                stream: streaming,
                ...(streaming ? { tools: [SEARCH_TOOL, PAGE_TOOL], tool_choice: 'auto' } : {}),
            }),
        });

        return response;
    }

    function toChatFormat(messages: Message[]): ChatMsg[] {
        return messages.map(msg => {
            const images = (msg.attachments ?? []).filter(file => file.base64);

            if (images.length === 0) {
                return { role: msg.sender, content: msg.content };
            }

            return {
                role: msg.sender,
                content: [
                    ...(msg.content ? [{ type: 'text', text: msg.content }] : []),
                    ...images.map(file => ({
                        type: 'image_url',
                        image_url: {
                            url: `data:${file.mime};base64,${file.base64}`,
                        },
                    })),
                ],
            };
        });
    }

    function withSearchPrompt(history: ChatMsg[]): ChatMsg[] {
        if (history.length > 0 && history[0].role === 'system') {
            const [first, ...rest] = history;
            return [
                { ...first, content: `${SEARCH_SYSTEM_PROMPT}\n${first.content ?? ''}` },
                ...rest,
            ];
        }
        return [{ role: 'system', content: SEARCH_SYSTEM_PROMPT }, ...history];
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

async function* readOpenAiSse(response: Response): AsyncGenerator<string, StreamSummary> {
    let content = '';
    const toolSlots: { id: string; name: string; args: string }[] = [];

    const handleLine = (line: string): string[] => {
        const out: string[] = [];

        const json = parseSsePayload(line) as {
            choices?: {
                delta?: {
                    content?: unknown;
                    tool_calls?: {
                        id?: unknown;
                        index?: unknown;
                        function?: { name?: unknown; arguments?: unknown };
                    }[];
                };
            }[];
        } | null;

        if (!json) return out;

        const delta = json.choices?.[0]?.delta;
        if (!delta) return out;

        if (typeof delta.content === 'string' && delta.content) {
            content += delta.content;
            out.push(delta.content);
        }

        for (const call of delta.tool_calls ?? []) {
            const slot = slotAt(toolSlots, call.index);
            if (typeof call.id === 'string' && call.id) slot.id = call.id;
            if (typeof call.function?.name === 'string' && call.function.name) {
                slot.name = call.function.name;
            }
            if (typeof call.function?.arguments === 'string') {
                slot.args += call.function.arguments;
            }
        }

        return out;
    };

    for await (const line of readSseLines(response)) {
        for (const text of handleLine(line)) yield text;
    }

    const actions: ToolAction[] = [];
    for (const slot of toolSlots) {
        if (!slot.id) continue;

        if (
            slot.name &&
            slot.name !== SEARCH_TOOL_NAME &&
            slot.name !== PAGE_TOOL_NAME
        ) {
            actions.push({
                kind: 'search',
                callId: slot.id,
                query: `Unknown tool "${slot.name}" is not available. Answer from your own knowledge.`,
            });
            continue;
        }

        let parsed: Record<string, unknown> = {};
        try {
            parsed = JSON.parse(slot.args || '{}');
        } catch {
            parsed = {};
        }

        if (slot.name === PAGE_TOOL_NAME) {
            const url = typeof parsed.url === 'string' ? parsed.url : '';
            actions.push({ kind: 'page', callId: slot.id, url });
        } else {
            const query = typeof parsed.query === 'string' ? parsed.query : '';
            actions.push({ kind: 'search', callId: slot.id, query });
        }
    }

    const assistantMsg: ChatMsg | null =
        content || actions.length > 0
            ? {
                  role: 'assistant',
                  ...(content ? { content } : { content: null }),
                  ...(actions.length > 0
                      ? {
                            tool_calls: toolSlots
                                .filter(slot => slot.id)
                                .map(slot => ({
                                    id: slot.id,
                                    type: 'function',
                                    function: {
                                        name: slot.name || SEARCH_TOOL_NAME,
                                        arguments: slot.args,
                                    },
                                })),
                        }
                      : {}),
              }
            : null;

    return { assistantMsg, actions };
}

function slotAt(slots: { id: string; name: string; args: string }[], index: unknown): {
    id: string;
    name: string;
    args: string;
} {
    const i = typeof index === 'number' && index >= 0 ? index : slots.length;
    while (slots.length <= i) slots.push({ id: '', name: '', args: '' });
    return slots[i];
}
