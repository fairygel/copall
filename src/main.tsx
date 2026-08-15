import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from './storage/queryClient';
import { localStoragePersister } from './storage/persister';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister: localStoragePersister,
                maxAge: 1000 * 60 * 60 * 24,
            }}
        >
            <App />
        </PersistQueryClientProvider>
    </React.StrictMode>
);
