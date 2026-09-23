import Message from './message';

export default interface Chat {
    id: string;
    name: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    lastMessageAt?: number;
}

export interface ChatMeta {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    lastMessageAt?: number;
}

