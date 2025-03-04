// Bing搜索API配置
const BING_SEARCH_API_KEY = process.env.BING_SEARCH_API_KEY || 'YOUR_BING_SEARCH_API_KEY';
const BING_SEARCH_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';

// 生成SERP查询
export interface SearchQuery {
    query: string;
    researchGoal: string;
}

export interface QueriesResponse {
    queries: SearchQuery[];
}

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
export { bingSearch };