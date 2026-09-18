import { getApiKey } from '../../config/AiProviderConfig';
import { AiProvider } from '../../models/AiProvider';
import Message from '../../models/message';
import {
    fetchPageContent,
    formatPageContent,
    formatSearchResults,
    searchWeb,
} from '../SearchService';
import { parseSsePayload, readSseLines } from '../AiUtils';
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

const TOOL_DECLARATIONS = [
    {
        name: SEARCH_TOOL_NAME,
        description: SEARCH_TOOL_DESCRIPTION,
        parameters: SEARCH_TOOL_SCHEMA,
    },
    {
        name: PAGE_TOOL_NAME,
        description: PAGE_TOOL_DESCRIPTION,
        parameters: PAGE_TOOL_SCHEMA,
    },
];

const MAX_PART_CHARS = 6000;

interface ContentMsg {
    role: string;
    parts: unknown[];
}

type ToolAction =
    | { kind: 'search'; name: string; args: Record<string, unknown>; query: string }
    | { kind: 'page'; name: string; args: Record<string, unknown>; url: string };

interface StreamSummary {
    modelParts: { text: string }[];
    functionCalls: { name: string; args: Record<string, unknown> }[];
}

export function createGeminiService(provider: AiProvider): BaseClient {
    return {
        async generateResponse(messages: Message[], model: string): Promise<string> {
            const response = await fetchChatRequest(
                toGeminiContents(messages),
                toGeminiSystemInstruction(messages),
                model,
                false
            );

            await checkErrorResponse(response);

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        },

        async *generateStream(messages: Message[], model: string): AsyncGenerator<string> {
            const contents: ContentMsg[] = toGeminiContents(messages);
            const systemText = [SEARCH_SYSTEM_PROMPT, ...systemMessages(messages)]
                .filter(Boolean)
                .join('\n');
            let searchesUsed = 0;

            for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
                const response = await fetchChatRequest(contents, systemText, model, true);

                await checkErrorResponse(response);

                const summary: StreamSummary = yield* readGeminiSse(response);

                const [firstCall, ...restCalls] = summary.functionCalls;

                const knownCall =
                    firstCall &&
                    (firstCall.name === SEARCH_TOOL_NAME || firstCall.name === PAGE_TOOL_NAME)
                        ? firstCall
                        : null;

                if (summary.modelParts.length > 0 || knownCall) {
                    contents.push({
                        role: 'model',
                        parts: [
                            ...trimTexts(summary.modelParts),
                            ...(knownCall
                                ? [
                                      {
                                          functionCall: {
                                              name: knownCall.name,
                                              args: knownCall.args,
                                          },
                                      },
                                  ]
                                : []),
                        ],
                    });
                }

                if (firstCall && !knownCall) {
                    contents.push(
                        toolResult(
                            firstCall.name,
                            `Unknown tool "${firstCall.name}" is not available. Answer from your own knowledge.`
                        )
                    );
                }

                if (restCalls.length > 0) {
                    contents.push({
                        role: 'function',
                        parts: restCalls
                            .filter(
                                call =>
                                    call.name === SEARCH_TOOL_NAME || call.name === PAGE_TOOL_NAME
                            )
                            .map(call => ({
                                functionResponse: {
                                    name: call.name,
                                    response: {
                                        name: call.name,
                                        content: {
                                            result:
                                                'Only one tool call is allowed per step. ' +
                                                'Wait for the other result, then ' +
                                                'call again alone if still needed.',
                                        },
                                    },
                                },
                            })),
                    });
                }

                if (!knownCall || round === MAX_TOOL_ROUNDS) return;

                const action = toAction(knownCall);

                if (action.kind === 'search') {
                    if (searchesUsed >= MAX_SEARCHES) {
                        contents.push(
                            toolResult(
                                SEARCH_TOOL_NAME,
                                `Search limit reached (${MAX_SEARCHES} per message). ` +
                                    'Open one of the URLs from the results you already have ' +
                                    'with open_page, or answer from what you have.'
                            )
                        );
                        continue;
                    }

                    if (!action.query) {
                        contents.push(emptyResult(SEARCH_TOOL_NAME));
                        continue;
                    }

                    searchesUsed += 1;

                    yield `\n\n> [search] Searching the web: ${action.query}\n\n`;

                    contents.push(await runSearch(action.query));
                } else {
                    if (!action.url) {
                        contents.push(emptyResult(PAGE_TOOL_NAME));
                        continue;
                    }

                    yield `\n\n> [search] Opening page: ${action.url}\n\n`;

                    contents.push(await runOpenPage(action.url));
                }
            }
        },
    };

    function emptyResult(toolName: string): ContentMsg {
        const hint =
            toolName === PAGE_TOOL_NAME
                ? 'Empty page URL, use an exact URL from search results.'
                : 'Empty search query, ask the user to clarify.';
        return {
            role: 'function',
            parts: [
                {
                    functionResponse: {
                        name: toolName,
                        response: {
                            name: toolName,
                            content: { result: hint },
                        },
                    },
                },
            ],
        };
    }

    async function runSearch(query: string): Promise<ContentMsg> {
        let result: string;

        try {
            result = formatSearchResults(query, await searchWeb(query));
        } catch (e) {
            result =
                `Web search failed (${(e as Error).message}). ` +
                'Answer from your own knowledge and warn that it may be outdated.';
        }

        return toolResult(SEARCH_TOOL_NAME, result);
    }

    async function runOpenPage(url: string): Promise<ContentMsg> {
        let result: string;

        try {
            result = formatPageContent(await fetchPageContent(url));
        } catch (e) {
            result =
                `Page open failed (${(e as Error).message}). ` +
                'Answer from the search snippets you already have.';
        }

        return toolResult(PAGE_TOOL_NAME, result);
    }

    function toolResult(toolName: string, result: string): ContentMsg {
        return {
            role: 'function',
            parts: [
                {
                    functionResponse: {
                        name: toolName,
                        response: { name: toolName, content: { result } },
                    },
                },
            ],
        };
    }

    async function fetchChatRequest(
        contents: ContentMsg[],
        systemText: string | undefined,
        model: string,
        streaming: boolean
    ): Promise<Response> {
        const apiKey = getApiKey(provider);
        if (!apiKey) throw new Error(`For chatting, ${provider.name}ApiKey is required.`);

        const url = streaming
            ? `${provider.baseUrl}/models/${model}:streamGenerateContent?alt=sse`
            : `${provider.baseUrl}/models/${model}:generateContent`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
                ...(streaming
                    ? {
                          tools: [{ function_declarations: TOOL_DECLARATIONS }],
                          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
                      }
                    : {}),
                contents,
            }),
        });

        return response;
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
            throw new Error(`Gemini API - ${response.status}: ${details || response.statusText}`);
        }
    }
}

function toAction(call: { name: string; args: Record<string, unknown> }): ToolAction {
    if (call.name === PAGE_TOOL_NAME) {
        const url = typeof call.args.url === 'string' ? call.args.url.trim() : '';
        return { kind: 'page', name: call.name, args: call.args, url };
    }

    const query =
        typeof call.args.query === 'string' ? call.args.query.trim().slice(0, 400) : '';
    return { kind: 'search', name: call.name, args: call.args, query };
}

async function* readGeminiSse(response: Response): AsyncGenerator<string, StreamSummary> {
    const modelParts: { text: string }[] = [];
    const functionCalls: StreamSummary['functionCalls'] = [];

    const handleLine = (line: string): string[] => {
        const out: string[] = [];

        const json = parseSsePayload(line) as {
            candidates?: { content?: { parts?: unknown[] } }[];
        } | null;

        if (!json) return out;

        const parts = json.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) return out;

        for (const part of parts) {
            const p = part as {
                text?: unknown;
                functionCall?: { name?: unknown; args?: unknown };
            };

            if (typeof p.text === 'string' && p.text) {
                modelParts.push({ text: p.text });
                out.push(p.text);
            } else if (p.functionCall) {
                const name = p.functionCall.name;
                if (typeof name === 'string') {
                    const args = p.functionCall.args;
                    functionCalls.push({
                        name,
                        args:
                            args && typeof args === 'object'
                                ? (args as Record<string, unknown>)
                                : {},
                    });
                }
            }
        }

        return out;
    };

    for await (const line of readSseLines(response)) {
        for (const text of handleLine(line)) yield text;
    }

    return { modelParts, functionCalls };
}

function trimTexts(parts: { text: string }[]): { text: string }[] {
    return parts.map(part =>
        part.text.length > MAX_PART_CHARS
            ? { text: part.text.slice(0, MAX_PART_CHARS) + '…' }
            : part
    );
}

function systemMessages(messages: Message[]): string[] {
    return messages.filter(msg => msg.sender === 'system').map(m => m.content);
}

function toGeminiContents(messages: Message[]): ContentMsg[] {
    return messages
        .filter(msg => msg.sender !== 'system')
        .map(msg => ({
            role: msg.sender === 'assistant' ? 'model' : 'user',
            parts: [
                ...(msg.content ? [{ text: msg.content }] : []),
                ...(msg.attachments ?? [])
                    .filter(file => file.base64)
                    .map(file => ({
                        inlineData: {
                            mimeType: file.mime,
                            data: file.base64 as string,
                        },
                    })),
            ],
        }));
}

function toGeminiSystemInstruction(messages: Message[]): string | undefined {
    const parts = systemMessages(messages);
    if (parts.length === 0) return undefined;
    return parts.join('\n');
}
