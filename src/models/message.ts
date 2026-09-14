import AttachedFile from './AttachedFile';

type Role = 'user' | 'assistant' | 'system';

interface Message {
    id: string;
    content: string;
    sender: Role;
    attachments?: AttachedFile[];
}

export default Message;
