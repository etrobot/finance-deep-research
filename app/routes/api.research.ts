import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText,createDataStream } from 'ai';
import dotenv from 'dotenv';

dotenv.config();

// 创建OpenRouter客户端，并启用reasoning
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || 'YOUR_OPENROUTER_API_KEY',
  extraBody: { include_reasoning: true }, // 在客户端配置中启用思考内容
});

// Bing搜索API配置
const BING_SEARCH_API_KEY = process.env.BING_SEARCH_API_KEY || 'YOUR_BING_SEARCH_API_KEY';
const BING_SEARCH_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';

// 搜索函数 - 使用Bing API
async function bingSearch(query: string, limit = 5) {
  try {
    const params = new URLSearchParams({
      q: query,
      count: limit.toString(),
      responseFilter: 'Webpages',
      textFormat: 'HTML'
    });

    const response = await fetch(`${BING_SEARCH_ENDPOINT}?${params}`, {
      headers: {
        'Ocp-Apim-Subscription-Key': BING_SEARCH_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Bing API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.webPages || !data.webPages.value) {
      return [];
    }

    // 将结果转换为适合处理的格式
    return data.webPages.value.map((page: any) => ({
      url: page.url,
      content: page.snippet,
      title: page.name,
    }));
  } catch (error) {
    console.error("Bing搜索出错:", error);
    return [];
  }
}


// 移除JSON的markdown格式
function removeJsonMarkdown(text: string) {
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

// 生成SERP查询
interface SearchQuery {
  query: string;
  researchGoal: string;
}

interface QueriesResponse {
  queries: SearchQuery[];
}

async function generateSerpQueries(query: string, numQueries = 3, learnings: string[] = [], dataStream: any, encoder: any) {
  console.log('开始生成SERP查询，输入参数:', {
    query,
    numQueries,
    learningsCount: learnings.length
  });

  const modelName = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview-02-05:free';
  const model = openrouter.languageModel(modelName);
    
  const systemPrompt = "你是一个专业的研究助手，帮助用户深入研究各种主题。请根据用户的提示，生成搜索引擎查询以帮助研究该主题。";
  
  const promptText = `给定以下用户提示，生成一系列bing搜索引擎查询来研究该主题。最多返回${numQueries}个查询，但如果原始提示清晰明确，可以返回更少的查询。确保每个查询都是独特的，彼此不相似。
  
用户提示: ${query}
  
${learnings.length > 0 ? `以下是之前研究的一些发现，使用它们来生成更具体的查询:
${learnings.join('\n')}` : ''}

请以JSON格式返回，格式如下:
{
  "queries": [
    {
      "query": "bing搜索引擎查询(如果是金融类的,请指定相关的site,比如同花顺10jqka.com.cn或东方财富www.eastmoney.com等)",
      "researchGoal": "此查询的研究目标，以及如何深入研究"
    }
  ]}`;

  console.log('生成的提示文本:', promptText);

  let parsedQueries: QueriesResponse = { queries: [] };

  try {
    const result = await streamText({
      model,
      system: systemPrompt,
      prompt: promptText,
      onFinish: (result: any) => {
        console.log('AI响应完成，原始结果:', result);
        if (!result || (!result.content && !result.text)) {
          console.error('AI响应内容为空');
          return;
        }
        
        try {
          const cleanText = removeJsonMarkdown(result.text || result.content);
          console.log('清理后的文本:', cleanText);
          parsedQueries = JSON.parse(cleanText) as QueriesResponse;
          console.log('JSON解析成功，结果:', JSON.stringify(parsedQueries));
        } catch (e) {
          console.error('JSON解析失败，详细错误:', e);
          console.error('待解析的文本:', result.text || result.content);
        }
      }
    });

    const reader = result.textStream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = value as unknown as {
        type: string; textDelta?: string 
      }

      const deltaContent = chunk.textDelta || chunk;
      if (deltaContent) {
        dataStream.writeData(deltaContent.toString());
      }
    }

    if (parsedQueries && Array.isArray(parsedQueries.queries)) {
      return parsedQueries.queries;
    }

    console.warn('返回默认查询，因为解析结果无效');
    return [{ query, researchGoal: "研究用户提供的原始查询" }];
  } catch (error) {
    console.error('generateSerpQueries执行出错:', error);
    return [{ query, researchGoal: "研究用户提供的原始查询" }];
  }
}

// 处理搜索结果
async function processSerpResult(query: string, results: any, numLearnings = 3, dataStream: any, encoder: any) {
  if (!results || results.length === 0) {
    return { learnings: [], followUpQuestions: [] };
  }
    
  const modelName = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview-02-05:free';
  const model = openrouter.languageModel(modelName);
  
  const systemPrompt = "你是一个专业研究助手，擅长从搜索结果中提取有价值的信息。";
  
  const contents = results.map((item: any) => item.content).filter(Boolean);
  
  const promptText = `基于以下来自搜索查询"${query}"的内容，生成一系列有价值的发现。最多返回${numLearnings}个发现，但如果内容清晰，可以返回更少。确保每个发现都是独特的，不相似的。发现应该简洁明了，尽可能详细和信息丰富。确保包含任何实体，如人物、地点、公司、产品等，以及任何精确的指标、数字或日期。这些发现将用于进一步研究该主题。

${contents.join('\n\n')}

请以JSON格式返回，格式如下:
{
  "learnings": ["发现1", "发现2"],
  "followUpQuestions": ["后续问题1", "后续问题2", "后续问题3"]
}`;

  let processedResult = { learnings: [], followUpQuestions: [] };

  const result = await streamText({
    model,
    system: systemPrompt,
    prompt: promptText,
    onFinish: async (result: any) => {
      try {
        if (!result || (!result.content && !result.text)) {
          console.error('processSerpResult: AI响应内容为空');
          return;
        }
        const cleanText = removeJsonMarkdown(result.text || result.content);
        const parsed = JSON.parse(cleanText);
        processedResult = {
          learnings: parsed.learnings || [],
          followUpQuestions: parsed.followUpQuestions || []
        };
        console.log('JSON解析成功，结果:', JSON.stringify(processedResult).slice(0, 100) + '...');
      } catch (e) {
        console.error('processSerpResult JSON解析失败:', e);
        console.error('待解析的文本:', result.text || result.content);
      }
    }
  });
  
  const reader = result.textStream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = value as unknown as {
        type: string; textDelta?: string 
      }

      const deltaContent = chunk.textDelta || chunk;
      if (deltaContent) {
        dataStream.writeData(deltaContent.toString());
      }
    }
  
  return processedResult;
}

// 生成最终报告
async function writeFinalReport(prompt: string, learnings: any, visitedUrls: any, dataStream: any, encoder: any) {
  console.log("开始生成最终报告，输入数据:", {
    promptLength: prompt.length,
    learningsCount: learnings.length,
    urlsCount: visitedUrls.length
  });

  const modelName = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview-02-05:free';
  const model = openrouter.languageModel(modelName);
  
  const systemPrompt = "你是一个专业的研究助手，擅长基于收集的信息撰写详细的研究报告。请确保报告内容完整、结构清晰。";
  
  const promptText = `基于以下用户提示和founded发现，撰写一份详尽的研究报告。要求：
1. 报告篇幅至少3页
2. 包含所有重要发现
3. 使用清晰的标题和小节
4. 添加具体的数据支持
5. 确保内容逻辑连贯

用户提示: ${prompt}

founded发现:
${learnings.map((l: string, i: number) => `${i + 1}. ${l}`).join('\n')}

请使用Markdown格式撰写报告，包含以下结构：
1. 研究概述
2. 主要发现
3. 详细分析
4. 结论和建议`;

  console.log("准备调用AI模型生成报告...");
  
  try {
    const result = await streamText({
      model,
      system: systemPrompt,
      prompt: promptText,
    });
    console.log("AI模型响应成功，开始处理输出流");
        
    result.mergeIntoDataStream(dataStream, { sendReasoning: true });

    // 添加参考来源
    const urlsSection = `\n\n## 参考来源\n${visitedUrls.map((url: string) => `- ${url}`).join('\n')}`;
    dataStream.writeData({ type: 'text', content: urlsSection });
    
    return; // 不需要返回内容，因为已经写入流中
  } catch (error) {
    console.error("生成报告时发生错误:", error);
    throw error;
  }
}

// 深度研究函数
async function deepResearch(
  query: string,
  breadth = 1,
  depth = 1,
  learnings: string[] = [],
  visitedUrls: string[] = [],
  dataStream: any,
  encoder: any,
  currentDepth = 0
) {
  try {
    // 如果达到最大深度，返回当前结果
    if (currentDepth >= depth) {
      return { learnings, visitedUrls };
    }
    
    // 生成搜索查询
    const serpQueries = await generateSerpQueries(query, breadth, learnings, dataStream, encoder);
    
    let allLearnings = [...learnings];
    let allUrls = [...visitedUrls];
    
    // 处理每个搜索查询
    for (const serpQuery of serpQueries) {
      try {
        
        // 执行搜索
        const searchResults = await bingSearch(serpQuery.query, 5);
        
        // 收集URL
        const newUrls = searchResults.map((item: any) => item.url).filter(Boolean);
        allUrls = [...allUrls, ...newUrls];
        
        // 处理搜索结果
        const processedResults = await processSerpResult(
          serpQuery.query,
          searchResults,
          3,
          dataStream,
          encoder
        );
        
        // 添加新的发现
        allLearnings = [...allLearnings, ...processedResults.learnings];
        
        // 如果有后续问题且未达到最大深度，继续深入研究
        if (processedResults.followUpQuestions.length > 0 && currentDepth < depth - 1) {
          const newBreadth = Math.ceil(breadth / 2);
                    
          const nextQuery = `
前一个研究目标: ${serpQuery.researchGoal}
后续研究方向: ${processedResults.followUpQuestions.map((q: string) => `\n- ${q}`).join('')}
          `.trim();
          
          // 递归深入研究
          const deeperResults = await deepResearch(
            nextQuery,
            newBreadth,
            depth,
            allLearnings,
            allUrls,
            dataStream,
            encoder,
            currentDepth + 1
          );
          
          // 更新结果
          allLearnings = [...new Set([...allLearnings, ...deeperResults.learnings])];
          allUrls = [...new Set([...allUrls, ...deeperResults.visitedUrls])];
        }
      } catch (error) {
        console.error(`处理查询时出错: ${serpQuery.query}:`, error);
      }
    }
    
    // 去重
    allLearnings = [...new Set(allLearnings)];
    allUrls = [...new Set(allUrls)];
    return { learnings: allLearnings, visitedUrls: allUrls };
  } catch (error) {
    console.error("深度研究过程出错:", error);
    return { learnings, visitedUrls };
  }
}

export async function action({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { messages, breadth = 1, depth = 1 } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "聊天消息是必需的" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    
    if (!lastUserMessage || !lastUserMessage.content) {
      return new Response(
        JSON.stringify({ error: "未找到有效的用户查询" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const query = lastUserMessage.content;
    console.log("接收到的研究查询:", query);
    console.log("研究广度:", breadth, "研究深度:", depth);

    const dataStream = createDataStream({
      async execute(dataStream) {
        try {
          console.log("开始研究流程");
          
          // 执行深度研究
          const research = await deepResearch(
            query,
            breadth,
            depth,
            [],
            [],
            dataStream,  // 直接传入dataStream
            new TextEncoder()
          );

          console.log("深度研究完成，发现数量:", research.learnings.length);

          // 生成最终报告
          await writeFinalReport(
            query,
            research.learnings,
            research.visitedUrls,
            dataStream,  // 直接传入dataStream
            new TextEncoder()
          );

          console.log("研究流程全部完成");
        } catch (error) {
          console.error("处理研究流程时出错:", error);
          throw error;
        }
      },
      onError: (error: any) => {
        console.error("数据流处理出错:", error);
        return `处理请求时出错: ${error.message}`;
      },
    });

    return new Response(dataStream, {
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