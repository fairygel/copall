import {
    fetchPageContent as fetchPageContentNative,
    searchWeb as nativeSearchWeb,
    type WebSearchResult,
} from './NativeBridge';
import { getSearchApiKey } from '../config/SearchConfig';

interface CacheEntry {
    results: WebSearchResult[];
    fetchedAt: number;
}

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;

const cache = new Map<string, CacheEntry>();

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
    const key = query.trim().toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < SEARCH_CACHE_TTL_MS) return cached.results;
    if (cached) cache.delete(key);

    const apiKey = getSearchApiKey();
    if (!apiKey) {
        throw new Error(
            'LangSearch API key is missing. Add it in Settings → Api Keys → Web Search.'
        );
    }

    const results = await nativeSearchWeb(query, apiKey);

    cache.set(key, { results, fetchedAt: Date.now() });
    if (cache.size > MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
    }

    return results;
}

export async function fetchPageContent(url: string): Promise<PageContent> {
    return fetchPageContentNative(url);
}

export interface PageContent {
    url: string;
    title: string;
    text: string;
}

export function formatPageContent(content: PageContent): string {
    const text =
        `Page content for ${content.url} (${content.title}):\n` + content.text.slice(0, 4000);

    return text.length > 4500 ? text.slice(0, 4500) + '…' : text;
}

export function formatSearchResults(query: string, results: WebSearchResult[]): string {
    if (results.length === 0) {
        return (
            `No results found for "${query}". ` +
            'Answer from your own knowledge and warn that it may be outdated.'
        );
    }

    const lines = results.slice(0, 5).map((r, i) => {
        const snippet = r.snippet.length > 250 ? r.snippet.slice(0, 250) + '…' : r.snippet;
        return `${i + 1}. ${r.title}\n   ${r.url}\n   ${snippet}`;
    });

    const text =
        `Web search results for "${query}" (5 links with short snippets). ` +
        'Pick the most promising URL and call open_page on it for details. ' +
        'If that page has nothing useful, open the next URL from THIS list. ' +
        'When answering, cite sources as a "Sources" list with markdown links ' +
        '[Site Name](url), never bare URLs:\n' +
        lines.join('\n');

    return text.length > 4000 ? text.slice(0, 4000) + '…' : text;
}
