import type { MetaFunction } from "@remix-run/node";
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '@ai-sdk/react';

export const meta: MetaFunction = () => {
  return [
    { title: "AI Chat App" },
    { name: "description", content: "Chat with AI" },
  ];
};


// 封装聊天组件
function Chat() {
  const [input, setInput] = useState('');
  const [error, setError] = useState<Error | null>(null);

  // 使用 useChat hook 替代直接 fetch
  const { data,append, messages, status } = useChat({
    api: '/api/research',
    onError: (err) => {
      console.error("聊天请求出错:", err);
      // 添加更详细的错误日志
      if (err instanceof Error) {
        console.error("错误详情:", {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
      } else {
        console.error("非标准错误对象:", err);
      }
      setError(err instanceof Error ? err : new Error(String(err)));
    },
    onFinish: (message) => {
      console.log("聊天响应完成，消息详情:", {
        message
      });
    }
  });

  const sendMessage = (message: string) => {
    if (!message.trim()) return;
    
    console.log("准备发送消息:", message);
    console.log("当前状态:", status);
    setError(null);
    
    try {
      // 添加更详细的请求日志
      console.log("发送消息前的状态:", {
        messageContent: message,
        currentStatus: status,
        currentMessages: messages
      });
      
      append({
        role: 'user',
        content: message
      });
      
      console.log("消息发送成功");
    } catch (err) {
      console.error("发送消息时出错:", err);
      console.error("错误详细信息:", {
        error: err,
        errorType: typeof err,
        errorString: String(err)
      });
      
      const errorMessage = err instanceof Error 
        ? `${err.message}\n${err.stack}` 
        : String(err);
      setError(new Error(`发送消息失败: ${errorMessage}`));
    }
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && status !== 'streaming' && status !== 'submitted') {
      sendMessage(input);
      setInput('');
    }
  };

  // 判断是否正在加载
  const isLoading = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex flex-col h-screen">
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
              {message.role === 'assistant' && (
                <details className="mb-2 w-full max-w-[85%]">
                  <summary className="cursor-pointer text-sm hover:text-gray-700">
                    显示思考
                  </summary>
                  <div className="mt-2 rounded-lg border px-4 py-2 text-sm text-gray-600">
                  {data && data.map((item, index) => (
                      item?.toString()
                  ))}
                  {message.reasoning}
                  </div>
                </details>
              )}
              <div className={`rounded-lg px-4 py-2 max-w-[85%] ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'border'
              }`}>
                <ReactMarkdown
                  components={{
                    p: ({children}) => <p className="prose prose-sm max-w-none dark:prose-invert">{children}</p>
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          
          {status === 'streaming' && (
            <div className="flex flex-col items-start">
              <div className="mb-1 text-xs text-gray-500">
                AI助手
              </div>
              <div className="rounded-lg px-4 py-2 max-w-[85%] border">
                <p className="prose prose-sm max-w-none dark:prose-invert">思考中...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg px-4 py-2 bg-red-500 text-white">
                错误: {error.message}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t">
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

export default function Index() {
  return <Chat />;
}