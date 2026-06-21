import Message from "../models/message";

async function fetchMistralResponse(messages: Message[]): Promise<string> {
    const apiKey = localStorage.getItem('mistralApiKey');
    if (!apiKey) {
        throw new Error('API key not found');
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ 
            model: 'mistral-medium-3-5',
            messages: toMistralFormat(messages) 
        })
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMessage = errorBody?.message 
            || errorBody?.detail 
            || response.statusText;
        
        throw new Error(`Mistral API ${response.status}: ${errorMessage}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

export default fetchMistralResponse;

function toMistralFormat(messages: Message[]) {
    return messages.map((msg) => ({
        role: msg.sender,
        content: msg.content
    }));
}
