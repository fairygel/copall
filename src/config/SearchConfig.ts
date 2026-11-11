import { API_KEYS_CHANGED_EVENT } from './AiProviderConfig';

export const SEARCH_API_KEY_STORAGE_KEY = 'langsearchApiKey';

export const SEARCH_API_KEY_LABEL = 'LangSearch';

export const SEARCH_API_KEY_ICON = 'langsearch.svg';

export const SEARCH_API_KEY_PLACEHOLDER = 'Enter LangSearch API Key';

export function getSearchApiKey(): string {
    return (localStorage.getItem(SEARCH_API_KEY_STORAGE_KEY) || '').trim();
}

export function setSearchApiKey(apiKey: string) {
    localStorage.setItem(SEARCH_API_KEY_STORAGE_KEY, apiKey.trim());
    window.dispatchEvent(new Event(API_KEYS_CHANGED_EVENT));
}
