export interface AiProvider {
    name: string;
    baseUrl: string;
    clientType: 'openai' | 'gemini';
    icon: string;
}