import type { MetaFunction } from "@remix-run/node";
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export const meta: MetaFunction = () => {
  return [
    { title: "AI Chat App" },
    { name: "description", content: "Chat with AI" },
  ];
};

// 简化消息类型
type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 发送消息到API
  const sendMessage = async (message: string) => {
    if (!message.trim()) return;
    
    // 添加用户消息到聊天记录
    const userMessage: Message = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("发送消息:", message);
      
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage] // 发送整个对话历史
        }),
      });
      
      if (!response.ok) {
        throw new Error('请求失败');
      }
      
      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');
      
      let fullContent = '';
      // 为新的助手消息创建一个空对象
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      console.log("开始接收流式响应...");
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log("流读取完成，总内容长度:", fullContent.length);
          break;
        }
        
        // 将二进制数据转换为文本
        const chunk = new TextDecoder().decode(value);
        console.log("收到数据块:", chunk.substring(0, 30) + (chunk.length > 30 ? "..." : ""));
        
        fullContent += chunk;
        
        // 更新消息列表
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: fullContent
          };
          return newMessages;
        });
      }
    } catch (err) {
      console.error("发送消息时出错:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      
      // 如果出错，移除最后一条未完成的助手消息
      setMessages(prev => 
        prev[prev.length - 1]?.role === 'assistant' && prev[prev.length - 1]?.content === '' 
          ? prev.slice(0, -1) 
          : prev
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 my-8">
              开始一个新的对话吧！
            </div>
          )}
          
          {messages.map((message, i) => (
            <div key={i} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="mb-1 text-xs text-gray-500">
                {message.role === 'user' ? '你' : 'AI助手'}
              </div>
              {message.role === 'assistant' && message.content.includes('<think>') && (
                <details className="mb-2 w-full max-w-[85%]">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    显示思考过程
                  </summary>
                  <div className="mt-2 rounded-lg border bg-gray-50 px-4 py-2 text-sm text-gray-600">
                    {message.content
                      .split(/<\/?think>/)
                      .filter((part, i) => i % 2 === 1)
                      .map((thought, j) => (
                        <div key={j} className="mb-2 whitespace-pre-wrap">{thought.trim()}</div>
                      ))}
                  </div>
                </details>
              )}
              <div className={`rounded-lg px-4 py-2 max-w-[85%] ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border'
              }`}>
                {message.role === 'assistant' ? (
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p className="prose prose-sm max-w-none dark:prose-invert">{children}</p>
                    }}
                  >
                    {message.content.split(/<\/?think>/).filter((part, i) => i % 2 === 0).join('').trim()}
                  </ReactMarkdown>
                ) : (
                  <ReactMarkdown
                    components={{
                      p: (props) => <p {...props} className="prose prose-sm max-w-none dark:prose-invert" />,
                    }}
                  >
                    {message.content || (isLoading ? '思考中...' : '')}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          
          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg px-4 py-2 bg-red-500 text-white">
                错误: {error.message}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
        <div className="max-w-3xl mx-auto flex gap-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            className="flex-1 rounded-lg px-4 py-2 border"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {isLoading ? "发送中..." : "发送"}
          </button>
        </div>
      </form>
    </div>
  );
}