type Role = 'user' | 'assistant';

interface Message {
    id: string;
    content: string;
    sender: Role;
}

export default Message;