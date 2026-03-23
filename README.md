# GenAI Drawio Creator

<div align="center">

**AI-Powered Diagram Creation Tool - Chat, Draw, Visualize**

English | [中文](./docs/cn/README_CN.md) | [日本語](./docs/ja/README_JA.md)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb)](https://react.dev/)

</div>

A Next.js web application that integrates AI capabilities with draw.io diagrams. Create, modify, and enhance diagrams through natural language commands and AI-assisted visualization.


## Table of Contents
- [Examples](#examples)
- [Features](#features)
- [MCP Server (Preview)](#mcp-server-preview)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Multi-Provider Support](#multi-provider-support)
- [How It Works](#how-it-works)
- [Citation](#citation)
- [FAQ](#faq)

## Examples

Here are some example prompts and their generated diagrams:

<div align="center">
<table width="100%">
  <tr>
    <td colspan="2" valign="top" align="center">
      <strong>Animated transformer connectors</strong><br />
      <p><strong>Prompt:</strong> Give me a **animated connector** diagram of transformer's architecture.</p>
      <img src="./public/animated_connectors.svg" alt="Transformer Architecture with Animated Connectors" width="480" />
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>GCP architecture diagram</strong><br />
      <p><strong>Prompt:</strong> Generate a GCP architecture diagram with **GCP icons**. In this diagram, users connect to a frontend hosted on an instance.</p>
      <img src="./public/gcp_demo.svg" alt="GCP Architecture Diagram" width="480" />
    </td>
    <td width="50%" valign="top">
      <strong>AWS architecture diagram</strong><br />
      <p><strong>Prompt:</strong> Generate a AWS architecture diagram with **AWS icons**. In this diagram, users connect to a frontend hosted on an instance.</p>
      <img src="./public/aws_demo.svg" alt="AWS Architecture Diagram" width="480" />
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>Azure architecture diagram</strong><br />
      <p><strong>Prompt:</strong> Generate a Azure architecture diagram with **Azure icons**. In this diagram, users connect to a frontend hosted on an instance.</p>
      <img src="./public/azure_demo.svg" alt="Azure Architecture Diagram" width="480" />
    </td>
    <td width="50%" valign="top">
      <strong>Cat sketch prompt</strong><br />
      <p><strong>Prompt:</strong> Draw a cute cat for me.</p>
      <img src="./public/cat_demo.svg" alt="Cat Drawing" width="240" />
    </td>
  </tr>
</table>
</div>

## Features

### Core
-   **LLM-Powered Diagram Creation**: Leverage Large Language Models to create and manipulate draw.io diagrams directly through natural language commands
-   **Non-Destructive Iteration**: Edit diagrams by cell ID — the agent modifies only the targeted elements, preserving all user refinements (positions, styles, groupings) across updates. Full regeneration is never needed.
-   **Image-Based Diagram Replication**: Upload existing diagrams or images and have the AI replicate and enhance them automatically
-   **PDF & Text File Upload**: Upload PDF documents and text files to extract content and generate diagrams from existing documents
-   **Interactive Chat Interface**: Communicate with AI to refine your diagrams in real-time
-   **Cloud Architecture Diagram Support**: 34+ shape libraries (AWS, GCP, Azure, Kubernetes, BPMN, UML, Cisco, Material Design, and more)
-   **Animated Connectors**: Create dynamic and animated connectors between diagram elements for better visualization

### Agentic Features (NEW)

-   **Action-as-Feedback (AaF)**: When you manually edit diagram elements on the canvas (change colors, move nodes, rename labels), the system detects your changes and describes them to the AI agent. For high-potential changes like style edits, the agent proactively offers to apply the same change across all similar elements — turning 1 manual edit into many coordinated updates. Zero LLM calls for the detection; all diff classification and NL translation is deterministic.
-   **Semantic Verification**: After the AI generates a diagram, the system programmatically checks whether all requested components are present by comparing generated vertex labels against the user's request using directional string matching. If components are missing, the system injects specific feedback ("Missing: Redis Cache, Message Queue") so the agent adds them via `edit_diagram` — no open-ended "is this complete?" self-reflection.
-   **Multi-Level Validation Pipeline**: Every generated diagram passes through structural validation (11 checks + 24-step auto-fix) and optional VLM visual validation (renders to bitmap, inspects for overlaps and layout issues). Critical issues trigger automatic repair.
-   **Environment-Aware Generation (MCP)**: The agent reads your actual codebase via MCP — `package.json`, `docker-compose.yml`, route files — to discover components users forget to mention in text descriptions.

### Quality of Life
-   **Diagram History**: Automatic snapshots before each AI edit, with visual thumbnails and one-click restore
-   **AI Reasoning Display**: View the AI's thinking process for supported models (OpenAI o1/o3, Gemini, Claude, etc.)
-   **Prompt Caching**: System prompt and conversation history are cached (Bedrock), reducing input token cost by ~90% for repeated interactions
-   **Streaming**: Real-time streaming of AI responses and diagram previews during generation

## MCP Server (Preview)

> **Preview Feature**: This feature is experimental and may not be stable.

Use GenAI Drawio Creator with AI agents like Claude Desktop, Cursor, and VS Code via MCP (Model Context Protocol).

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["@genai-drawio-creator/mcp-server@latest"]
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add drawio -- npx @genai-drawio-creator/mcp-server@latest
```

Then ask Claude to create diagrams:
> "Create a flowchart showing user authentication with login, MFA, and session management"

The diagram appears in your browser in real-time!

See the [MCP Server README](./packages/mcp-server/README.md) for VS Code, Cursor, and other client configurations.

## Getting Started

### Try it Online

No installation needed! Try the app directly on our demo site.

> **Bring Your Own API Key**: You can use your own API key to bypass usage limits on the demo site. Click the Settings icon in the chat panel to configure your provider and API key. Your key is stored locally in your browser and is never stored on the server.

### Desktop Application

Download the native desktop app for your platform from the [Releases page](https://github.com/genai-drawio-creator/genai-drawio-creator/releases):

Supported platforms: Windows, macOS, Linux.

### Run with Docker

[Go to Docker Guide](./docs/en/docker.md)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/genai-drawio-creator/genai-drawio-creator
cd genai-drawio-creator
npm install
cp env.example .env.local
```

See the [Provider Configuration Guide](./docs/en/ai-providers.md) for detailed setup instructions for each provider.

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:6002](http://localhost:6002) in your browser to see the application.

## Deployment

### Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgenai-drawio-creator%2Fgenai-drawio-creator)

The easiest way to deploy is using [Vercel](https://vercel.com/new), the creators of Next.js. Be sure to **set the environment variables** in the Vercel dashboard as you did in your local `.env.local` file.

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Deploy on Cloudflare Workers

[Go to Cloudflare Deploy Guide](./docs/en/cloudflare-deploy.md)



## Multi-Provider Support

-   AWS Bedrock (default)
-   OpenAI
-   Anthropic
-   Google AI
-   Google Vertex AI
-   Azure OpenAI
-   Ollama
-   OpenRouter
-   DeepSeek
-   SiliconFlow
-   ModelScope
-   SGLang
-   Vercel AI Gateway


All providers except AWS Bedrock and OpenRouter support custom endpoints.

📖 **[Detailed Provider Configuration Guide](./docs/en/ai-providers.md)** - See setup instructions for each provider.

### Server-Side Multi-Model Configuration

Administrators can configure multiple server-side models that are available to all users without requiring personal API keys. Configure via `AI_MODELS_CONFIG` environment variable (JSON string) or `ai-models.json` file.

**Model Requirements**: This task requires strong model capabilities for generating long-form text with strict formatting constraints (draw.io XML). Recommended models include Claude Sonnet 4.5, GPT-5.1, Gemini 3 Pro, and DeepSeek V3.2/R1.

Note that the `claude` series has been trained on draw.io diagrams with cloud architecture logos like AWS, Azure, GCP. So if you want to create cloud architecture diagrams, this is the best choice.


## How It Works

The application runs a **plan–tool–reflect** agentic loop:

1. **Plan**: The LLM receives the user's request, the current diagram XML, and (if applicable) a description of the user's recent manual edits (Action-as-Feedback). It plans which changes to make.
2. **Tool Use**: The agent calls one of four structured tools:
   - `display_diagram(xml)` — generate a new diagram from scratch
   - `edit_diagram(operations)` — ID-based add/update/delete on specific cells (non-destructive)
   - `get_diagram()` — read the current diagram state
   - `get_shape_library(category)` — look up icon syntax for 34+ shape libraries
3. **Reflect**: The system validates the output (structural checks + optional VLM visual inspection + semantic verification), and if issues are found, injects feedback so the agent self-corrects.

**Tech stack:**
-   **Next.js 16** + **React 19**: Frontend framework with split-pane UI (chat + draw.io canvas)
-   **Vercel AI SDK** (`ai` + `@ai-sdk/*`): Streaming responses, tool calling, multi-provider support
-   **draw.io**: Embedded diagram editor via iframe, communicating over `postMessage`
-   **MCP Server**: Standalone Node.js process exposing diagram tools to Claude Desktop, VS Code, and Cursor


## Support & Contact

For support or inquiries, please open an issue on the GitHub repository.

## Citation

If you use GenAI Drawio Creator in your research, please cite the following papers:

```bibtex
@article{yu2025genai,
  title={GenAI-DrawIO-Creator: A Framework for Automated Diagram Generation},
  author={Jinze Yu and Dayuan Jiang},
  journal={arXiv preprint arXiv:2601.05162},
  year={2025}
}
```

```bibtex
@inproceedings{yu2025genai-kdd,
  title={GenAI-DrawIO-Creator: A Framework for Automated Diagram Generation},
  author={Jinze Yu and Dayuan Jiang and others},
  booktitle={KDD 2025 Workshop on Scientific and Societal Advances enabled by Large Language Models (SciSocLLM)},
  year={2025},
  url={https://openreview.net/forum?id=mZEJWVDUtt}
}
```

- Jinze Yu, Dayuan Jiang. *GenAI-DrawIO-Creator: A Framework for Automated Diagram Generation*. [arXiv:2601.05162](https://arxiv.org/abs/2601.05162), 2025.
- Jinze Yu, Dayuan Jiang, et al. *GenAI-DrawIO-Creator: A Framework for Automated Diagram Generation*. KDD 2025 Workshop SciSocLLM. [OpenReview](https://openreview.net/forum?id=mZEJWVDUtt), 2025.

## FAQ

See [FAQ](./docs/en/FAQ.md) for common issues and solutions.

---
