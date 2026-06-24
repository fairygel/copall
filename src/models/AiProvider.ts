export interface AiProvider {
    name: string;
    baseUrl: string;
    apiType: 'openai' | 'gemini';
    icon: string;
}