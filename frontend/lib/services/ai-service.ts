/**
 * AI Provider abstraction layer.
 *
 * Supports Groq, OpenAI, Claude (Anthropic), Kimi (Moonshot AI), and Google Gemini.
 * Each provider implements a common interface for chat completion and vision tasks.
 * Includes auto-fallback, retry with backoff, and rule-based fallback insights.
 */
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/services/encryption';

// ============================================
// Provider Types & Config
// ============================================

export type AIProviderType = 'groq' | 'openai' | 'claude' | 'kimi' | 'gemini';

export interface ProviderConfig {
    default_model: string;
    fallback_model: string;
    api_key_setting: string;
    display_name: string;
    key_url: string;
    supports_json_mode: boolean;
    supports_vision: boolean;
}

export const PROVIDER_CONFIG: Record<AIProviderType, ProviderConfig> = {
    groq: {
        default_model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        fallback_model: 'llama-3.3-70b-versatile',
        api_key_setting: 'groq_api_key',
        display_name: 'Groq',
        key_url: 'https://console.groq.com/keys',
        supports_json_mode: true,
        supports_vision: true,
    },
    openai: {
        default_model: 'gpt-4o-mini',
        fallback_model: 'gpt-3.5-turbo',
        api_key_setting: 'openai_api_key',
        display_name: 'OpenAI',
        key_url: 'https://platform.openai.com/api-keys',
        supports_json_mode: true,
        supports_vision: true,
    },
    claude: {
        default_model: 'claude-sonnet-4-5-20250929',
        fallback_model: 'claude-haiku-3-5-20241022',
        api_key_setting: 'claude_api_key',
        display_name: 'Claude (Anthropic)',
        key_url: 'https://console.anthropic.com/settings/keys',
        supports_json_mode: false,
        supports_vision: true,
    },
    kimi: {
        default_model: 'moonshot-v1-8k',
        fallback_model: 'moonshot-v1-8k',
        api_key_setting: 'kimi_api_key',
        display_name: 'Kimi (Moonshot AI)',
        key_url: 'https://platform.moonshot.cn/console/api-keys',
        supports_json_mode: true,
        supports_vision: false,
    },
    gemini: {
        default_model: 'gemini-2.5-flash',
        fallback_model: 'gemini-2.5-flash',
        api_key_setting: 'gemini_api_key',
        display_name: 'Google Gemini',
        key_url: 'https://aistudio.google.com/apikey',
        supports_json_mode: true,
        supports_vision: true,
    },
};

const ALL_PROVIDERS: AIProviderType[] = ['groq', 'openai', 'claude', 'kimi', 'gemini'];

// Known secret settings
const SECRET_KEYS = new Set([
    'groq_api_key', 'openai_api_key', 'claude_api_key',
    'kimi_api_key', 'gemini_api_key', 'rentcast_api_key',
]);

// ============================================
// Settings Helpers
// ============================================

export async function getSettingValue(key: string, userId?: string): Promise<string | null> {
    const setting = userId
        ? await prisma.appSettings.findUnique({ where: { user_id_key: { user_id: userId, key } } })
        : await prisma.appSettings.findFirst({ where: { key } });
    if (!setting?.value) return null;
    if (SECRET_KEYS.has(key)) {
        return decrypt(setting.value);
    }
    return setting.value;
}

// ============================================
// Provider Resolution
// ============================================

export async function resolveProvider(userId?: string): Promise<{
    provider: AIProviderType;
    apiKey: string | null;
    model: string;
}> {
    const chosenStr = (await getSettingValue('ai_provider', userId)) || 'groq';
    const modelOverride = await getSettingValue('ai_model', userId);

    let chosen: AIProviderType = ALL_PROVIDERS.includes(chosenStr as AIProviderType)
        ? (chosenStr as AIProviderType)
        : 'groq';

    // Check chosen provider first
    const chosenKey = await getSettingValue(PROVIDER_CONFIG[chosen].api_key_setting, userId);
    if (chosenKey) {
        return {
            provider: chosen,
            apiKey: chosenKey,
            model: modelOverride || PROVIDER_CONFIG[chosen].default_model,
        };
    }

    // Fallback: scan all providers for any configured key
    for (const provider of ALL_PROVIDERS) {
        if (provider === chosen) continue;
        const key = await getSettingValue(PROVIDER_CONFIG[provider].api_key_setting, userId);
        if (key) {
            return {
                provider,
                apiKey: key,
                model: modelOverride || PROVIDER_CONFIG[provider].default_model,
            };
        }
    }

    // Check OPENAI_API_KEY env var as last resort
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) {
        return {
            provider: 'openai',
            apiKey: envKey,
            model: modelOverride || PROVIDER_CONFIG.openai.default_model,
        };
    }

    return { provider: chosen, apiKey: null, model: PROVIDER_CONFIG[chosen].default_model };
}

// ============================================
// Chat Completion (Unified Interface)
// ============================================

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
}

export async function chatCompletion(
    messages: ChatMessage[],
    options: ChatOptions = {},
): Promise<string | null> {
    const { provider, apiKey, model: defaultModel } = await resolveProvider();
    if (!apiKey) return null;

    const model = options.model || defaultModel;
    const temperature = options.temperature ?? 0.3;
    const maxTokens = options.maxTokens ?? 1000;
    const jsonMode = options.jsonMode ?? false;

    try {
        switch (provider) {
            case 'groq':
                return await callOpenAICompatible(
                    apiKey,
                    'https://api.groq.com/openai/v1',
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    jsonMode,
                );
            case 'openai':
                return await callOpenAICompatible(
                    apiKey,
                    undefined,
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    jsonMode,
                );
            case 'claude':
                return await callClaude(apiKey, model, messages, temperature, maxTokens, jsonMode);
            case 'kimi':
                return await callOpenAICompatible(
                    apiKey,
                    'https://api.moonshot.ai/v1',
                    model,
                    messages,
                    temperature,
                    maxTokens,
                    jsonMode,
                );
            case 'gemini':
                return await callGemini(apiKey, model, messages, temperature, maxTokens, jsonMode);
            default:
                return null;
        }
    } catch (e) {
        console.error(`AI ${provider} error:`, e);
        return null;
    }
}

async function callOpenAICompatible(
    apiKey: string,
    baseURL: string | undefined,
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    jsonMode: boolean,
): Promise<string> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
        timeout: 30000,
    });

    const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    });
    return response.choices[0]?.message?.content?.trim() ?? '';
}

async function callClaude(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    jsonMode: boolean,
): Promise<string> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    let systemText = '';
    const userMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const msg of messages) {
        if (msg.role === 'system') {
            systemText += msg.content + '\n';
        } else {
            userMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
    }

    if (jsonMode) {
        systemText += '\n\nCRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks.';
    }

    const response = await client.messages.create({
        model,
        messages: userMessages,
        temperature,
        max_tokens: maxTokens,
        ...(systemText.trim() ? { system: systemText.trim() } : {}),
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text.trim() : '';
}

async function callGemini(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number,
    jsonMode: boolean,
): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey });

    let systemText = '';
    let userText = '';
    for (const msg of messages) {
        if (msg.role === 'system') {
            systemText += msg.content + '\n';
        } else {
            userText += msg.content + '\n';
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: Record<string, any> = {
        temperature,
        maxOutputTokens: maxTokens,
    };
    if (jsonMode) {
        config.responseMimeType = 'application/json';
    }
    if (systemText.trim()) {
        config.systemInstruction = systemText.trim();
    }

    const response = await client.models.generateContent({
        model,
        contents: userText.trim(),
        config,
    });
    return response.text?.trim() ?? '';
}

// ============================================
// Retry Logic
// ============================================

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

export async function chatCompletionWithRetry(
    messages: ChatMessage[],
    options: ChatOptions = {},
): Promise<string | null> {
    let lastError: unknown;
    let delay = INITIAL_RETRY_DELAY;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await chatCompletion(messages, options);
        } catch (e) {
            lastError = e;
            const errorStr = String(e).toLowerCase();

            // Don't retry on auth or quota errors
            if (/authentication|invalid.api.key|unauthorized|insufficient_quota|billing|quota/.test(errorStr)) {
                throw e;
            }

            // Rate limit: wait and retry
            if (/rate_limit|429/.test(errorStr)) {
                await new Promise((r) => setTimeout(r, 5000));
                continue;
            }

            if (attempt < MAX_RETRIES - 1) {
                await new Promise((r) => setTimeout(r, delay));
                delay *= 2;
            }
        }
    }

    console.error(`All ${MAX_RETRIES} AI attempts failed:`, lastError);
    return null;
}

// ============================================
// JSON Response Parsing
// ============================================

export function parseJsonResponse(text: string): unknown {
    text = text.trim();

    // Remove markdown code blocks
    if (text.startsWith('```')) {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) text = match[1];
    }

    // Try direct parse
    try {
        return JSON.parse(text);
    } catch {
        // Try to find JSON array or object
        for (const pattern of [/\[[\s\S]*\]/, /\{[\s\S]*\}/]) {
            const match = text.match(pattern);
            if (match) {
                try {
                    return JSON.parse(match[0]);
                } catch {
                    continue;
                }
            }
        }
    }

    throw new Error(`Could not parse JSON from response: ${text.slice(0, 200)}...`);
}

// ============================================
// Provider Info (for settings page)
// ============================================

export async function getAIProviders(userId?: string) {
    const { provider: activeProvider, model: activeModel } = await resolveProvider(userId);

    const providers = [];
    for (const [id, config] of Object.entries(PROVIDER_CONFIG)) {
        const apiKey = await getSettingValue(config.api_key_setting, userId);
        providers.push({
            id,
            name: config.display_name,
            is_active: id === activeProvider,
            is_configured: Boolean(apiKey),
            key_url: config.key_url,
            default_model: config.default_model,
            supports_vision: config.supports_vision,
            supports_json_mode: config.supports_json_mode,
        });
    }

    return {
        providers,
        active_provider: activeProvider,
        active_model: activeModel,
    };
}
