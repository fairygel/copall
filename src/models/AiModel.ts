import { AiProvider } from './AiProvider';

interface AiModel {
    id: string;
    name: string;
    provider: AiProvider;
    context: number;
    inputModalities: string[];
}

export default AiModel;
