export function removeJsonMarkdown(text: string) {
    if (!text) {
        console.error('removeJsonMarkdown: 输入文本为空');
        return '';
    }

    console.log('removeJsonMarkdown 输入:', text);
    text = text.trim();
    if (text.startsWith('```json')) {
        text = text.slice(7);
    } else if (text.startsWith('json')) {
        text = text.slice(4);
    } else if (text.startsWith('```')) {
        text = text.slice(3);
    }
    if (text.endsWith('```')) {
        text = text.slice(0, -3);
    }
    console.log('removeJsonMarkdown 输出:', text.trim());
    return text.trim();
}