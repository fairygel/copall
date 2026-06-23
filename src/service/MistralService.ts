import Message from "../models/message";

export async function fetchMistralResponse(messages: Message[]): Promise<string> {
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
            messages: toMistralFormat(messages),
        })
    });

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Mistral API ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

export async function* fetchMistralStream(messages: Message[]): AsyncGenerator<string> {
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
            messages: toMistralFormat(messages),
            stream: true,
        })
    });

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Mistral API ${response.status}: ${errorText}`);
    }


    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line === 'data: [DONE]') {
                return;
            }
            if (!line.startsWith('data: ')) continue;

            const json = JSON.parse(line.slice(6));
            const content = json.choices?.[0]?.delta?.content;

            if (content) {
                yield content;
            }
        }
    }
}

function toMistralFormat(messages: Message[]) {
    return messages.map((msg) => ({
        role: msg.sender,
        content: msg.content
    }));
}
