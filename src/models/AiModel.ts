import { AiProvider } from './AiProvider';

interface AiModel {
    id: string; // provider/model-name
    name: string;
    provider: AiProvider;
    context: number;
}

export default AiModel;
