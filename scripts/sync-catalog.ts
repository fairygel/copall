import { writeFileSync } from 'fs';
import { AVAILABLE_PROVIDERS } from '../src/config/AiProviderConfig';
import 'dotenv/config';

interface Model {
    id: string;
    name: string;
    context: number;
    created: number;
    inputModalities: string[];
    outputModalities: string[];
    inputPricing: string;
    outputPricing: string;
}

const allowedProviders = new Set(AVAILABLE_PROVIDERS.map(p => p.id));

async function fetchAllowedModels(): Promise<Set<string>> {
    const allowedModels = new Set<string>();

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

    if (GEMINI_API_KEY) {
        try {
            let result = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
            );
            if (!result.ok) {
                throw new Error(`Gemini API error: ${result.status} ${result.statusText}`);
            }
            let json = await result.json();

            for (const model of json.models ?? []) {
                const segment = model.name?.split('/')?.[1];
                if (segment) allowedModels.add(segment);
            }
        } catch (e) {
            console.error('Gemini error:', e);
            throw e;
        }
    }

    if (MISTRAL_API_KEY) {
        try {
            let result = await fetch('https://api.mistral.ai/v1/models', {
                headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` }
            });
            if (!result.ok) {
                throw new Error(`Mistral API error: ${result.status} ${result.statusText}`);
            }
            let json = await result.json()

            for (const model of json.data ?? []) {
                allowedModels.add(model.id);
            }
        } catch (e) {
            console.error('Mistral error:', e)
            throw e;
        }
    }

    if (!GEMINI_API_KEY && !MISTRAL_API_KEY) {
        console.warn('No GEMINI_API_KEY or MISTRAL_API_KEY set — per-provider catalog entries will be empty');
    }

    return allowedModels;
}


async function buildCatalog() {
    let response = await fetch(
        'https://openrouter.ai/api/v1/models?output_modalities=text&input_modalities=text&sort=newest'
    );
    if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }
    let json = await response.json();

    let allowedModels = await fetchAllowedModels();

    const catalog: Record<string, Model[]> = {};
    catalog['open-router'] = [];
    catalog['vercel'] = [];

    for (let model of json.data ?? []) {
        const providerId = model.id.split('/')[0];
        const modelName = model.id.split('/')[1];

        const openRouterEntry: Model = {
            id: 'open-router/' + model.id,
            name: model.name,
            context: model.context_length,
            created: model.created,
            inputModalities: model.architecture.input_modalities,
            outputModalities: model.architecture.output_modalities,
            inputPricing: model.pricing.prompt,
            outputPricing: model.pricing.completion,
        };

        if (allowedProviders.has(providerId) && allowedModels.has(modelName)) {
            const providerModelEntry: Model = {
                id: model.id,
                name: model.name.split(': ')[1] ?? model.name,
                context: model.context_length,
                created: model.created,
                inputModalities: model.architecture.input_modalities,
                outputModalities: model.architecture.output_modalities,
                inputPricing: model.pricing.prompt,
                outputPricing: model.pricing.completion,
            };

            if (!catalog[providerId]) {
                catalog[providerId] = [];
            }

            catalog[providerId].push(providerModelEntry);
        }

        catalog['open-router'].push(openRouterEntry);
    }

    try {
        const vercelRes = await fetch('https://ai-gateway.vercel.sh/v1/models');
        if (!vercelRes.ok) {
            throw new Error(`Vercel API error: ${vercelRes.status} ${vercelRes.statusText}`);
        }
        const vercelJson = await vercelRes.json();

        for (const model of vercelJson.data ?? []) {
            const inputMods: string[] = model.modalities?.input ?? ['text'];
            const outputMods: string[] = model.modalities?.output ?? ['text'];
            if (!inputMods.includes('text') || !outputMods.includes('text')) {
                continue;
            }
            catalog['vercel'].push({
                id: 'vercel/' + model.id,
                name: model.name ?? model.id,
                context: model.context_window ?? model.max_tokens ?? 0,
                created: model.created ?? 0,
                inputModalities: inputMods,
                outputModalities: outputMods,
                inputPricing: model.pricing?.input ?? '0',
                outputPricing: model.pricing?.output ?? '0',
            });
        }
    } catch (e) {
        console.error('Vercel error:', e);
        throw e;
    }

    const jsonString = JSON.stringify(catalog, null, 4);
    writeFileSync('public/catalog.json', jsonString);
}


buildCatalog().catch(e => {
    console.error(e);
    process.exit(1);
});
