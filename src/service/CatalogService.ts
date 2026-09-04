import { AVAILABLE_PROVIDERS } from '../config/AiProviderConfig';
import AiModel from '../models/AiModel';

type CatalogEntry = {
    id: string;
    name: string;
    context: number;
};

type Catalog = Record<string, CatalogEntry[]>;

let cache: AiModel[] | null = null;

async function loadCatalog(): Promise<AiModel[]> {
    if (cache) return cache;

    const res = await fetch('/catalog.json');
    if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);

    const json: Catalog = await res.json();
    const byId = new Map(AVAILABLE_PROVIDERS.map(p => [p.id, p]));

    const models: AiModel[] = [];

    for (const [providerId, entries] of Object.entries(json)) {
        const provider = byId.get(providerId);
        if (!provider) continue;

        for (const e of entries) {
            models.push({
                id: e.id,
                name: e.name,
                context: e.context ?? 0,
                provider,
            });
        }
    }

    cache = models;

    return models;
}

export async function getModelsFromCatalog(): Promise<AiModel[]> {
    return loadCatalog();
}

export async function getModelFromCatalog(modelId: string): Promise<AiModel> {
    const models = await loadCatalog();

    const found = models.find(m => m.id === modelId);
    if (!found) throw new Error(`Model ${modelId} not found in catalog.`);

    return found;
}
