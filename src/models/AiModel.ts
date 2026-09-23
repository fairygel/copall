import { AiProvider } from './AiProvider';

export type ReasoningLevel = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const REASONING_LEVELS: readonly ReasoningLevel[] = [
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'max',
];

export interface ReasoningConfig {
    supported: boolean;
    levels: ReasoningLevel[];
}

interface AiModel {
    id: string;
    name: string;
    provider: AiProvider;
    context: number;
    inputModalities: string[];
    reasoning: ReasoningConfig;
}

export default AiModel;
