import { AiProvider } from '../models/AiProvider';

export const AVAILABLE_PROVIDERS: AiProvider[] = [
    {
        id: 'mistralai',
        name: 'Mistral',
        baseUrl: 'https://api.mistral.ai',
        clientType: 'openai',
        icon: 'mistral.svg',
    },
    {
        id: 'google',
        name: 'Google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        clientType: 'gemini',
        icon: 'gemini.svg',
    },
    {
        id: 'open-router',
        name: 'Open Router',
        baseUrl: 'https://openrouter.ai/api',
        clientType: 'openai',
        icon: 'openrouter.svg',
    },
];

export function getApiKey(provider: AiProvider): string {
    return localStorage.getItem(provider.id + 'ApiKey') || '';
}

export function setApiKey(provider: AiProvider, apiKey: string) {
    localStorage.setItem(provider.id + 'ApiKey', apiKey);
}
