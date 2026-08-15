import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const localStoragePersister = createAsyncStoragePersister({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    key: 'AI_APP_OFFLINE_CACHE',
    throttleTime: 1000,
});
