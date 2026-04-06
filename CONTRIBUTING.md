# Contributing to GenAI DrawIO Creator

Thank you for your interest in contributing! This project is open to all contributions.

## Quick Start

```bash
git clone https://github.com/tuoxie2046/GenAI-DrawIO-Creator
cd GenAI-DrawIO-Creator
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

Create a `.env.local` file:

```env
OPENAI_API_KEY=sk-...           # Required for OpenAI
ANTHROPIC_API_KEY=sk-ant-...    # Optional, for Claude
GEMINI_API_KEY=...               # Optional, for Google Gemini
AZURE_OPENAI_ENDPOINT=...       # Optional, for Azure OpenAI
KIMI_API_KEY=...                # Optional, for Kimi
```

## Project Structure

```
├── app/                    # Next.js app router pages
├── components/             # React components
├── lib/                   # Utilities
│   ├── drawio-xml.ts      # Draw.io XML generation
│   ├── ai-providers/      # AI provider integrations
│   └── prompts.ts         # System prompts
├── public/                # Static assets
└── docs/                  # Documentation
```

## Adding a New AI Provider

1. Create a new file in `lib/ai-providers/`
2. Implement the AIProvider interface
3. Add to the provider selector UI

## Pull Request Process

1. Fork and create a branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run `npm run lint`
4. Submit a PR

## Ideas for Contributions

Looking for something to work on? Check out issues tagged **good first issue**!

Common requests:
- New AI provider integrations
- New diagram templates
- Mobile UI improvements
- Translation improvements
- Documentation additions
