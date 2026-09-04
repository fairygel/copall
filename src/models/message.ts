type Role = 'user' | 'assistant' | 'system';

interface Message {
    id: string;
    content: string;
    sender: Role;
}

export default Message;
