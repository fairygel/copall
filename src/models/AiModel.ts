import { AiProvider } from './AiProvider';

interface AiModel {
    id: string;
    name: string;
    provider: AiProvider;
    context: number;
}

export default AiModel;
