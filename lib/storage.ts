// Centralized localStorage keys for quota tracking and settings
// Chat data is now stored in IndexedDB via session-storage.ts

export const STORAGE_KEYS = {
    // Quota tracking
    requestCount: "genai-drawio-creator-request-count",
    requestDate: "genai-drawio-creator-request-date",
    tokenCount: "genai-drawio-creator-token-count",
    tokenDate: "genai-drawio-creator-token-date",
    tpmCount: "genai-drawio-creator-tpm-count",
    tpmMinute: "genai-drawio-creator-tpm-minute",

    // Settings
    accessCode: "genai-drawio-creator-access-code",
    accessCodeRequired: "genai-drawio-creator-access-code-required",
    aiProvider: "genai-drawio-creator-ai-provider",
    aiBaseUrl: "genai-drawio-creator-ai-base-url",
    aiApiKey: "genai-drawio-creator-ai-api-key",
    aiModel: "genai-drawio-creator-ai-model",

    // Multi-model configuration
    modelConfigs: "genai-drawio-creator-model-configs",
    selectedModelId: "genai-drawio-creator-selected-model-id",

    // Chat input preferences
    sendShortcut: "genai-drawio-creator-send-shortcut",

    // Diagram validation
    vlmValidationEnabled: "genai-drawio-creator-vlm-validation-enabled",

    // Custom system message
    customSystemMessage: "genai-drawio-creator-custom-system-message",
} as const
