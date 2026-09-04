export interface AiProvider {
    id: string;
    name: string;
    baseUrl: string;
    clientType: 'openai' | 'gemini';
    icon: string;
}
