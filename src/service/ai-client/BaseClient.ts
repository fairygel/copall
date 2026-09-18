import Message from '../../models/message';

export interface BaseClient {
    generateResponse(messages: Message[], model: string): Promise<string>;
    generateStream(messages: Message[], model: string): AsyncGenerator<string>;
}

export const MAX_SEARCHES = 2;

export const MAX_TOOL_ROUNDS = 6;

export const SEARCH_TOOL_NAME = 'web_search';

export const PAGE_TOOL_NAME = 'open_page';

export const SEARCH_TOOL_DESCRIPTION =
    'Search the web for current or unknown information. ALWAYS call it when unsure, ' +
    'when facts may be outdated, or when the user needs current data ' +
    '(instructions, news, docs, versions, prices, weather, etc.). ' +
    'Returns 5 links with short snippets. After EVERY web_search you MUST call ' +
    'open_page on the most promising URL — never answer from snippets alone. ' +
    'You get at most 2 searches per user message, so NEVER reformulate the query — ' +
    'open pages from the results you already have instead.';

export const PAGE_TOOL_DESCRIPTION =
    'Open a page from earlier search results and read its full text (trimmed to ~4000 chars). ' +
    'Use it right after web_search: pick the most promising URL and open it. ' +
    'If the page has no useful details, open the next URL from the same results. ' +
    'Pass the exact URL from the search results. ' +
    'Prefer opening pages over another web_search — you only get 2 searches per message.';

export const SEARCH_TOOL_SCHEMA = {
    type: 'object',
    properties: {
        query: {
            type: 'string',
            description: 'Search query (up to ~400 chars)',
        },
    },
    required: ['query'],
};

export const PAGE_TOOL_SCHEMA = {
    type: 'object',
    properties: {
        url: {
            type: 'string',
            description: 'Exact URL from earlier search results',
        },
    },
    required: ['url'],
};

export const SEARCH_SYSTEM_PROMPT =
    'You have web_search and open_page tools. CALL web_search AGGRESSIVELY — whenever you are unsure, ' +
    'when facts may be outdated, or when the user needs current data ' +
    '(recent events, versions, prices, docs, how-tos for apps, weather, etc.). ' +
    'Never guess from memory where a search could verify it. ' +
    'MANDATORY workflow after every web_search: you MUST call open_page on the most promising URL ' +
    'from the results. Do NOT answer from snippets alone, do NOT search again before opening. ' +
    'If the opened page has nothing useful, open the next URL from the SAME results. ' +
    'Make ONE tool call at a time and wait for the result. ' +
    'Never send multiple tool calls in a single response. ' +
    'You get at most 2 web_search calls per user message: make the first query count ' +
    '(English query + city and country names for weather, e.g. "weather in Grodno, Belarus"). ' +
    'A second web_search is allowed only after you opened at least one page and it had nothing useful. ' +
    'Cite sources as a "Sources" list at the end of your answer, using markdown links ' +
    'with the site name as text: - [Site Name](https://example.com/page). ' +
    'Never paste bare URLs like "Source: https://..." into the answer text. ' +
    `Today is ${new Date().toISOString().slice(0, 10)} — say so when results look outdated.`;
