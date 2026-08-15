import { AiProvider } from '../models/AiProvider';

export const AVAILABLE_PROVIDERS: AiProvider[] = [
    {
        name: 'Mistral',
        baseUrl: 'https://api.mistral.ai',
        clientType: 'openai',
        icon: 'mistral.svg',
    },
    {
        name: 'Google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        clientType: 'gemini',
        icon: 'gemini.svg',
    },
    {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api',
        clientType: 'openai',
        icon: 'openrouter.svg',
    },
];

export function getApiKey(provider: AiProvider): string {
    return localStorage.getItem(provider.name + 'ApiKey') || '';
}

export function setApiKey(provider: AiProvider, apiKey: string) {
    localStorage.setItem(provider.name + 'ApiKey', apiKey);
}
