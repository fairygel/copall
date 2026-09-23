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
    ChatOptions,
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
        type: 'function',
        name: SEARCH_TOOL_NAME,
        description: SEARCH_TOOL_DESCRIPTION,
        parameters: SEARCH_TOOL_SCHEMA,
    },
    {
        type: 'function',
        name: PAGE_TOOL_NAME,
        description: PAGE_TOOL_DESCRIPTION,
        parameters: PAGE_TOOL_SCHEMA,
    },
];

type TextPart = { type: 'text'; text: string };
type ImagePart = { type: 'image'; data: string; mime_type: string };

type InputStep =
    | { type: 'user_input'; content: (TextPart | ImagePart)[] }
    | { type: 'model_output'; content: TextPart[] }
    | { type: 'function_result'; name: string; result: string };

interface FunctionCall {
    id: string;
    name: string;
    args: Record<string, unknown>;
}

interface InteractionSummary {
    interactionId: string | null;
    status: string;
    text: string;
    calls: FunctionCall[];
}

export function createGeminiService(provider: AiProvider): BaseClient {
    return {
        async generateResponse(
            messages: Message[],
            model: string,
            options?: ChatOptions
        ): Promise<string> {
            const systemInstruction = toGeminiSystemInstruction(messages);

            const response = await fetchInteraction(
                {
                    model,
                    ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
                    ...generationConfig(options?.reasoning),
                    input: toInteractionInput(messages),
                },
                false
            );

            await checkErrorResponse(response);

            const data = await response.json();
            return parseInteraction(data).text;
        },

        async *generateStream(
            messages: Message[],
            model: string,
            options?: ChatOptions
        ): AsyncGenerator<string> {
            const systemText = [SEARCH_SYSTEM_PROMPT, ...systemMessages(messages)]
                .filter(Boolean)
                .join('\n');
            const config = generationConfig(options?.reasoning);
            let searchesUsed = 0;

            let prevId: string | null = null;
            let input: InputStep[] = toInteractionInput(messages);

            for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
                const response = await fetchInteraction(
                    {
                        model,
                        ...(prevId ? { previous_interaction_id: prevId } : {}),
                        system_instruction: systemText,
                        tools: TOOL_DECLARATIONS,
                        ...config,
                        input,
                    },
                    true
                );

                await checkErrorResponse(response);

                const summary: InteractionSummary = {
                    ...(yield* readInteractionSse(response)),
                    text: '',
                };

                if (summary.interactionId) prevId = summary.interactionId;

                const [firstCall, ...restCalls] = summary.calls;

                const knownCall =
                    firstCall &&
                    (firstCall.name === SEARCH_TOOL_NAME || firstCall.name === PAGE_TOOL_NAME)
                        ? firstCall
                        : null;

                if (!knownCall || round === MAX_TOOL_ROUNDS) return;

                if (!prevId) return;

                const results: InputStep[] = [];

                if (firstCall && !knownCall) {
                    results.push({
                        type: 'function_result',
                        name: firstCall.name,
                        result: `Unknown tool "${firstCall.name}" is not available. Answer from your own knowledge.`,
                    });
                }

                for (const skipped of restCalls) {
                    results.push({
                        type: 'function_result',
                        name: skipped.name,
                        result:
                            'Only one tool call is allowed per step. ' +
                            'Wait for the other result, then ' +
                            'call again alone if still needed.',
                    });
                }

                const action = toAction(knownCall);

                if (action.kind === 'search') {
                    if (searchesUsed >= MAX_SEARCHES) {
                        results.push({
                            type: 'function_result',
                            name: SEARCH_TOOL_NAME,
                            result:
                                `Search limit reached (${MAX_SEARCHES} per message). ` +
                                'Open one of the URLs from the results you already have ' +
                                'with open_page, or answer from what you have.',
                        });
                    } else if (!action.query) {
                        results.push({
                            type: 'function_result',
                            name: SEARCH_TOOL_NAME,
                            result: 'Empty search query, ask the user to clarify.',
                        });
                    } else {
                        searchesUsed += 1;

                        yield `\n\n> [search] Searching the web: ${action.query}\n\n`;

                        results.push({
                            type: 'function_result',
                            name: SEARCH_TOOL_NAME,
                            result: await runSearch(action.query),
                        });
                    }
                } else {
                    if (!action.url) {
                        results.push({
                            type: 'function_result',
                            name: PAGE_TOOL_NAME,
                            result: 'Empty page URL, use an exact URL from search results.',
                        });
                    } else {
                        yield `\n\n> [search] Opening page: ${action.url}\n\n`;

                        results.push({
                            type: 'function_result',
                            name: PAGE_TOOL_NAME,
                            result: await runOpenPage(action.url),
                        });
                    }
                }

                input = results;
            }
        },
    };

    async function runSearch(query: string): Promise<string> {
        try {
            return formatSearchResults(query, await searchWeb(query));
        } catch (e) {
            return (
                `Web search failed (${(e as Error).message}). ` +
                'Answer from your own knowledge and warn that it may be outdated.'
            );
        }
    }

    async function runOpenPage(url: string): Promise<string> {
        try {
            return formatPageContent(await fetchPageContent(url));
        } catch (e) {
            return (
                `Page open failed (${(e as Error).message}). ` +
                'Answer from the search snippets you already have.'
            );
        }
    }

    async function fetchInteraction(body: Record<string, unknown>, streaming: boolean) {
        const apiKey = getApiKey(provider);
        if (!apiKey) throw new Error(`For chatting, ${provider.name}ApiKey is required.`);

        const response = await fetch(`${provider.baseUrl}/interactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(streaming ? { ...body, stream: true } : body),
        });

        return response;
    }

    async function checkErrorResponse(response: Response) {
        if (response.ok) return;

        let details = '';
        try {
            const err = await response.json();
            const first = Array.isArray(err) ? err[0] : err;
            details =
                first?.error?.message || first?.message || first?.error || JSON.stringify(err);
        } catch {
            details = response.statusText;
        }
        throw new Error(`Gemini API - ${response.status}: ${details || response.statusText}`);
    }
}

type ToolAction =
    | { kind: 'search'; query: string }
    | { kind: 'page'; url: string };

function toAction(call: { name: string; args: Record<string, unknown> }): ToolAction {
    if (call.name === PAGE_TOOL_NAME) {
        const url = typeof call.args.url === 'string' ? call.args.url.trim() : '';
        return { kind: 'page', url };
    }

    const query =
        typeof call.args.query === 'string' ? call.args.query.trim().slice(0, 400) : '';
    return { kind: 'search', query };
}

function generationConfig(reasoning?: ChatOptions['reasoning']): {
    generation_config: { thinking_level: string };
} | Record<string, never> {
    if (!reasoning || reasoning === 'default') return {};
    if (reasoning === 'none') return {};
    return { generation_config: { thinking_level: reasoning } };
}

function toInteractionInput(messages: Message[]): InputStep[] {
    return messages
        .filter(msg => msg.sender !== 'system')
        .map((msg): InputStep => {
            if (msg.sender === 'assistant') {
                return {
                    type: 'model_output',
                    content: msg.content ? [{ type: 'text', text: msg.content }] : [],
                };
            }

            const content: (TextPart | ImagePart)[] = [];
            if (msg.content) content.push({ type: 'text', text: msg.content });
            for (const file of msg.attachments ?? []) {
                if (file.base64) {
                    content.push({ type: 'image', data: file.base64, mime_type: file.mime });
                }
            }
            return { type: 'user_input', content };
        });
}

function systemMessages(messages: Message[]): string[] {
    return messages.filter(msg => msg.sender === 'system').map(m => m.content);
}

function toGeminiSystemInstruction(messages: Message[]): string | undefined {
    const parts = systemMessages(messages);
    if (parts.length === 0) return undefined;
    return parts.join('\n');
}

function parseInteraction(json: unknown): InteractionSummary {
    const root = (json ?? {}) as {
        id?: unknown;
        status?: unknown;
        steps?: unknown;
    };

    let text = '';
    const calls: FunctionCall[] = [];

    if (Array.isArray(root.steps)) {
        for (const step of root.steps) {
            const s = step as {
                type?: unknown;
                id?: unknown;
                name?: unknown;
                arguments?: unknown;
                content?: unknown;
            };

            if (s.type === 'model_output' && Array.isArray(s.content)) {
                for (const part of s.content) {
                    const p = part as { type?: unknown; text?: unknown };
                    if (p.type === 'text' && typeof p.text === 'string') text += p.text;
                }
            } else if (s.type === 'function_call' && typeof s.name === 'string') {
                calls.push({
                    id: typeof s.id === 'string' ? s.id : '',
                    name: s.name,
                    args:
                        s.arguments && typeof s.arguments === 'object'
                            ? (s.arguments as Record<string, unknown>)
                            : {},
                });
            }
        }
    }

    return {
        interactionId: typeof root.id === 'string' ? root.id : null,
        status: typeof root.status === 'string' ? root.status : '',
        text,
        calls,
    };
}

interface PendingCall {
    id: string;
    name: string;
    argsText: string;
    argsObj: Record<string, unknown> | null;
}

async function* readInteractionSse(
    response: Response
): AsyncGenerator<string, { interactionId: string | null; status: string; calls: FunctionCall[] }> {
    const pending = new Map<number, PendingCall>();
    let interactionId: string | null = null;
    let status = '';

    const handlePayload = (json: unknown): string[] => {
        const out: string[] = [];
        if (!json || typeof json !== 'object') return out;

        const payload = json as {
            event_type?: unknown;
            index?: unknown;
            interaction?: { id?: unknown; status?: unknown };
            step?: { type?: unknown; id?: unknown; name?: unknown; arguments?: unknown };
            delta?: { type?: unknown; text?: unknown; arguments?: unknown };
        };

        if (payload.event_type === 'interaction.created' && payload.interaction) {
            if (typeof payload.interaction.id === 'string') {
                interactionId = payload.interaction.id;
            }
            return out;
        }

        if (payload.event_type === 'interaction.completed' && payload.interaction) {
            if (typeof payload.interaction.id === 'string') {
                interactionId = payload.interaction.id;
            }
            if (typeof payload.interaction.status === 'string') {
                status = payload.interaction.status;
            }
            return out;
        }

        if (payload.event_type === 'step.start' && payload.step && typeof payload.index === 'number') {
            if (payload.step.type === 'function_call') {
                pending.set(payload.index, {
                    id: typeof payload.step.id === 'string' ? payload.step.id : '',
                    name: typeof payload.step.name === 'string' ? payload.step.name : '',
                    argsText: '',
                    argsObj:
                        payload.step.arguments && typeof payload.step.arguments === 'object'
                            ? (payload.step.arguments as Record<string, unknown>)
                            : null,
                });
            }
            return out;
        }

        if (
            payload.event_type === 'step.delta' &&
            payload.delta &&
            typeof payload.index === 'number'
        ) {
            if (payload.delta.type === 'text' && typeof payload.delta.text === 'string') {
                if (payload.delta.text) out.push(payload.delta.text);
            } else if (
                payload.delta.type === 'arguments_delta' &&
                typeof payload.delta.arguments === 'string'
            ) {
                const slot = pending.get(payload.index);
                if (slot) slot.argsText += payload.delta.arguments;
            }
            return out;
        }

        return out;
    };

    for await (const line of readSseLines(response)) {
        for (const text of handlePayload(parseSsePayload(line))) yield text;
    }

    const calls: FunctionCall[] = [];
    for (const slot of pending.values()) {
        if (!slot.name) continue;

        let args: Record<string, unknown> = slot.argsObj ?? {};
        if (slot.argsText) {
            try {
                const parsed: unknown = JSON.parse(slot.argsText);
                if (parsed && typeof parsed === 'object') {
                    args = parsed as Record<string, unknown>;
                }
            } catch {
                // keep argsObj fallback
            }
        }
        calls.push({ id: slot.id, name: slot.name, args });
    }

    return { interactionId, status, calls };
}
