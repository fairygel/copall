import AiModel from "../models/AiModel";
import { AiProvider } from "../models/AiProvider";
import Message from "../models/message";

export interface BaseClient {
    generateResponse(messages: Message[], model: string): Promise<string>;
    generateStream(messages: Message[], model: string): AsyncGenerator<string>;
    getModelInfo(model: string): Promise<AiModel>;
    getAvailableModels(provider: AiProvider): Promise<AiModel[]>;
}