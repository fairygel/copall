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
            let json = await result.json();
            
            for (const model of json.models ?? []) {
                allowedModels.add(model.name.split('/')[1]);
            }
        } catch (e) { 
            console.error('Gemini error:', e);
        }
    }

    if (MISTRAL_API_KEY) {
        try {
            let result = await fetch('https://api.mistral.ai/v1/models', {
                headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` }
            });
            let json = await result.json()

            for (const model of json.data ?? []) {
                allowedModels.add(model.id);
            }
        } catch (e) { 
            console.error('Mistral error:', e)
        }
    }

    return allowedModels;
}


async function buildCatalog() {
    let response = await fetch(
        'https://openrouter.ai/api/v1/models?output_modalities=text&input_modalities=text&sort=newest'
    );
    let json = await response.json();

    let allowedModels = await fetchAllowedModels();

    const catalog: Record<string, Model[]> = {};
    catalog['open-router'] = [];
    catalog['vercel'] = [];

    for (let model of json.data) {
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
                name: model.name.split(': ')[1],
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
        const vercelJson = await vercelRes.json();

        for (const model of vercelJson.data) {
            catalog['vercel'].push({
                id: 'vercel/' + model.id,
                name: model.name ?? model.id,
                context: model.context_window ?? model.max_tokens ?? 0,
                created: model.created ?? 0,
                inputModalities: model.modalities?.input ?? ['text'],
                outputModalities: model.modalities?.output ?? ['text'],
                inputPricing: model.pricing?.input ?? '0',
                outputPricing: model.pricing?.output ?? '0',
            });
        }
    } catch (e) {
        console.error('Vercel error:', e);
    }

    const jsonString = JSON.stringify(catalog, null, 4);
    writeFileSync('public/catalog.json', jsonString);
}


buildCatalog().catch(e => {
    console.error(e);
    process.exit(1);
});
