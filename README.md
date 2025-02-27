# 金融深度研究

本项目致力于为金融领域的专业人士和爱好者提供一个深度研究平台。结合先进的搜索查询、流式数据处理和 AI 助手技术，系统可以自动生成金融研究报告，帮助用户快速提取关键数据、趋势和分析。

本项目的设计理念参考了 [AnotiaWang/deep-research-web-ui](https://github.com/AnotiaWang/deep-research-web-ui)，在此基础上针对金融领域进行优化，例如支持指定金融网站（如同花顺、东方财富等）进行搜索查询，确保研究结果更精准、更有实用价值。

## 功能特色

- **多层次研究流程**  
  支持递归的广度与深度搜索，能够针对金融主题生成多个查询，并逐步提取有价值的发现和后续研究方向。

- **流式数据处理**  
  利用流式响应技术，实时展示搜索结果和 AI 生成的报告，提升用户体验和系统响应效率。

- **AI 思考过程展示**  
  在生成报告时展示 AI 的思考过程，增加研究透明度，使得用户能够更清晰地了解研究逻辑和数据提取过程。

- **金融领域定制化**  
  针对金融主题定制搜索查询和报告生成规则，支持调用 Bing 搜索 API 获取金融数据，并对结果进行深度分析。

## 技术栈

- [Remix](https://remix.run/)（React 框架）
- TypeScript
- Tailwind CSS
- OpenRouter AI SDK
- Bing 搜索 API

## 安装与运行

### 前置条件

- Node.js (推荐版本 >= 16.x)
- npm 或 yarn 包管理器

### 安装依赖

在项目根目录下执行：

```shell
pnpm install
```


### 环境配置

在项目根目录创建 `.env` 文件，配置相关环境变量：

```env
OPENROUTER_API_KEY=你的OpenRouter_API_Key
BING_SEARCH_API_KEY=你的Bing_Search_API_Key
OPENROUTER_MODEL=使用的OpenRouter模型（例如：google/gemini-2.0-flash-lite-preview-02-05:free）
```

### 运行开发服务器

执行以下命令启动开发服务器：

```shell
pnpm run dev
```

项目会在 [http://localhost:5173](http://localhost:5173) 运行。


## 项目结构

- **app/**  
  包含项目的前端和后端相关代码，基于 Remix 框架构建。

- **app/routes/api.research.ts**  
  实现金融深度研究的业务逻辑，包括生成搜索查询、处理搜索结果、分析数据和生成最终报告。

- **app/routes/api.chat.ts**  
  提供 AI 聊天接口，展示 AI 助手的实时回复和思考过程。

- **其他配置文件**  
  如 `tailwind.config.ts`、`tsconfig.json`、`package.json` 等确保项目的正常运行和开发体验。


## 许可证

本项目采用 [MIT License](./LICENSE) 开源许可，详细信息请参见 LICENSE 文件。


---

感谢您使用和关注本项目，希望它能为您的金融深度研究带来帮助！