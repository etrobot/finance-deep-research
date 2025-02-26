import type { MetaFunction } from "@remix-run/node";
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export const meta: MetaFunction = () => {
  return [
    { title: "AI Chat App" },
    { name: "description", content: "Chat with AI" },
  ];
};

// 定义消息类型
type Message = {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
};

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showRaw, setShowRaw] = useState(false);

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
        const errorData = await response.json();
        throw new Error(errorData.error || '请求失败');
      }
      
      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');
      
      let assistantMessage = '';
      let reasoningContent = '';
      let isReasoningSection = false;
      
      // 为新的助手消息创建一个空对象
      setMessages(prev => [...prev, { role: 'assistant', content: '', reasoning: '' }]);
      
      console.log("开始接收流式响应...");
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log("流读取完成，总内容长度:", assistantMessage.length, "思考长度:", reasoningContent.length);
          break;
        }
        
        // 将二进制数据转换为文本
        const chunk = new TextDecoder().decode(value);
        console.log("收到数据块:", chunk.substring(0, 30) + (chunk.length > 30 ? "..." : ""));
        
        // 检测思考标签
        if (chunk.includes('<think>')) {
          isReasoningSection = true;
          // 移除标签部分，只保留内容
          const parts = chunk.split('<think>');
          if (parts[0]) assistantMessage += parts[0];
          if (parts[1]) reasoningContent += parts[1];
          continue;
        }
        
        if (chunk.includes('</think>')) {
          isReasoningSection = false;
          // 移除标签部分，只保留内容
          const parts = chunk.split('</think>');
          if (parts[1]) assistantMessage += parts[1];
          continue;
        }
        
        // 根据当前状态决定内容归属
        if (isReasoningSection) {
          reasoningContent += chunk;
        } else {
          assistantMessage += chunk;
        }
        
        // 更新消息列表
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0) {
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: assistantMessage,
              reasoning: reasoningContent
            };
          }
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
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 my-8">
              开始一个新的对话吧！
            </div>
          )}
          
          {messages.map((message, i) => (
            <div
              key={i}
              className={`flex flex-col ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                {message.role === 'user' ? '你' : 'AI助手'}
              </div>
              
              {/* 显示思考内容，放在回答上方 */}
              {message.reasoning && message.role === 'assistant' && (
                <details className="mt-2 mb-2 w-[85%]" open>
                  <summary className="cursor-pointer text-xs text-gray-700 dark:text-gray-300 font-medium">
                    思考过程
                  </summary>
                  <div className="mt-2 text-xs rounded-lg px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{message.reasoning}</pre>
                  </div>
                </details>
              )}
              
              <div className="flex justify-end w-full mb-1">
                <button 
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {showRaw ? '显示格式化内容' : '显示原始内容'}
                </button>
              </div>
              
              <div
                className={`rounded-lg px-4 py-2 max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 dark:text-white border dark:border-gray-700'
                }`}
              >
                {message.role === 'assistant' ? (
                  showRaw ? (
                    <pre className="whitespace-pre-wrap text-xs overflow-auto">
                      {message.content || (isLoading ? '思考中...' : '')}
                    </pre>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content || (isLoading ? '思考中...' : '')}
                    </ReactMarkdown>
                  )
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2 bg-white dark:bg-gray-800 dark:text-white">
                正在思考...
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg px-4 py-2 bg-red-500 text-white">
                错误: {error.message || "发生未知错误"}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-3xl mx-auto flex gap-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            className="flex-1 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 dark:text-white border dark:border-gray-700"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-opacity"
          >
            {isLoading ? "发送中..." : "发送"}
          </button>
        </div>
      </form>
    </div>
  );
}