import { AiProvider } from "../models/AiProvider";
import { BaseClient } from "./BaseClient";
import { createGeminiService } from "./GeminiClient";
import { createOpenAIClient } from "./OpenAIClient";

export function createClient(provider: AiProvider): BaseClient {
    const clientType = provider.clientType

    switch (clientType) {
        case 'openai':
            return createOpenAIClient(provider)
        case 'gemini':
            return createGeminiService(provider)
        default:
            throw new Error(`Invalid provider client: ${clientType}. Expected 'openai' or 'gemini'`)
    }
}
