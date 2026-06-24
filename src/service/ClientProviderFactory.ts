import { BaseClient } from "./BaseClient";
import { createGeminiService } from "./GeminiClient";
import { createMistralService } from "./MistralClient";

export function createClient(model: string): BaseClient {
    let provider = parseModel(model);

    switch (provider) {
        case 'mistral':
            return createMistralService()
        case 'google':
            return createGeminiService()
        default:
            throw new Error(`Invalid provider: ${provider}. Expected 'mistral' or 'google'`)
    }
}

type Provider = 'mistral' | 'google';

function parseModel(model: string): Provider {
    const slashIndex = model.indexOf('/');
    if (slashIndex === -1) {
        throw new Error(`Invalid model format: ${model}. Expected provider/model`);
    }
    const provider = model.slice(0, slashIndex) as Provider;

    return provider;
}