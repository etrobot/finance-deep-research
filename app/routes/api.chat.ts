import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
import dotenv from 'dotenv';

dotenv.config();

// 创建OpenRouter客户端，并启用reasoning
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || 'YOUR_OPENROUTER_API_KEY',
  extraBody: { include_reasoning: true }, // 在客户端配置中启用思考内容
});

export async function action({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "有效的messages数组是必需的" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 打印接收到的消息，帮助调试
    console.log("接收到的消息:", JSON.stringify(messages, null, 2));

    const modelName =
      process.env.OPENROUTER_MODEL ||
      'google/gemini-2.0-flash-lite-preview-02-05:free';
    
    console.log("使用模型:", modelName);
    
    // 确保消息格式正确
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const model = openrouter.languageModel(modelName);

    // 调用AI并获取完整流
    const result = await streamText({
      model,
      messages: formattedMessages,
      temperature: 0.7, // 添加温度参数
      maxTokens: 1000,  // 设置最大令牌数
    });

    // 创建一个新的ReadableStream来处理AI的响应
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();

    // 处理完整流，包括文本和思考内容
    (async () => {
      const encoder = new TextEncoder();
      let isReasoningActive = false;
      let hasContent = false;

      try {
        // 使用fullStream获取所有内容，包括思考部分
        for await (const part of result.fullStream) {
          let textToWrite = '';
          
          // 检查是否有文本内容
          if (part.type === "text-delta" && part.textDelta) {
            hasContent = true;
            if (isReasoningActive) {
              textToWrite = '</think>\n\n';
              isReasoningActive = false;
              await writer.write(encoder.encode(textToWrite));
            }
            textToWrite = part.textDelta;
          } 
          else if (part.type === "reasoning" && 'textDelta' in part && part.textDelta) {
            hasContent = true;
            if (!isReasoningActive) {
              textToWrite = '<think>\n';
              isReasoningActive = true;
              await writer.write(encoder.encode(textToWrite));
            }
            textToWrite = part.textDelta;
          }

          if (textToWrite) {
            await writer.write(encoder.encode(textToWrite));
          }
        }
        
        // 如果没有收到任何内容，发送一个默认消息
        if (!hasContent) {
          await writer.write(encoder.encode("抱歉，我无法生成回复。请尝试重新提问或使用不同的模型。"));
        }
        
        // 如果流结束时仍在思考内容中，关闭思考标签
        if (isReasoningActive) {
          await writer.write(encoder.encode('</think>\n\n'));
        }

        await writer.close();
      } catch (error) {
        console.error("处理流时出错:", error);
        writer.abort(error);
      }
    })();

    // 返回流式响应
    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error("API处理出错:", error);
    return new Response(
      JSON.stringify({
        error: "处理请求时出错",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}