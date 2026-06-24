import { AiProvider } from '../models/AiProvider';

export const AVAILABLE_PROVIDERS: AiProvider[] = [
    {
        name: 'Mistral',
        baseUrl: 'https://api.mistral.ai',
        apiType: 'openai',
        icon: 'mistral.svg'
    },
    {
        name: 'Google',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiType: 'gemini',
        icon: 'gemini.svg'
    }
]