"""
AI Provider abstraction layer.

Supports Groq, OpenAI, Claude (Anthropic), Kimi (Moonshot AI), and Google Gemini.
Each provider implements a common interface for chat completion and vision tasks.
"""
import os
import base64
import logging
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class AIProvider(str, Enum):
    GROQ = "groq"
    OPENAI = "openai"
    CLAUDE = "claude"
    KIMI = "kimi"
    GEMINI = "gemini"


PROVIDER_CONFIG = {
    AIProvider.GROQ: {
        "default_model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "fallback_model": "llama-3.3-70b-versatile",
        "api_key_setting": "groq_api_key",
        "display_name": "Groq",
        "key_url": "https://console.groq.com/keys",
        "supports_json_mode": True,
        "supports_vision": True,
    },
    AIProvider.OPENAI: {
        "default_model": "gpt-4o-mini",
        "fallback_model": "gpt-3.5-turbo",
        "api_key_setting": "openai_api_key",
        "display_name": "OpenAI",
        "key_url": "https://platform.openai.com/api-keys",
        "supports_json_mode": True,
        "supports_vision": True,
    },
    AIProvider.CLAUDE: {
        "default_model": "claude-sonnet-4-5-20250929",
        "fallback_model": "claude-haiku-3-5-20241022",
        "api_key_setting": "claude_api_key",
        "display_name": "Claude (Anthropic)",
        "key_url": "https://console.anthropic.com/settings/keys",
        "supports_json_mode": False,
        "supports_vision": True,
    },
    AIProvider.KIMI: {
        "default_model": "moonshot-v1-8k",
        "fallback_model": "moonshot-v1-8k",
        "api_key_setting": "kimi_api_key",
        "display_name": "Kimi (Moonshot AI)",
        "key_url": "https://platform.moonshot.cn/console/api-keys",
        "supports_json_mode": True,
        "supports_vision": False,
    },
    AIProvider.GEMINI: {
        "default_model": "gemini-2.5-flash",
        "fallback_model": "gemini-2.5-flash",
        "api_key_setting": "gemini_api_key",
        "display_name": "Google Gemini",
        "key_url": "https://aistudio.google.com/apikey",
        "supports_json_mode": True,
        "supports_vision": True,
    },
}

# Module-level cached state
_cached_provider: Optional[AIProvider] = None
_cached_api_keys: Dict[str, str] = {}
_cached_model: Optional[str] = None


def set_provider_config(
    provider: AIProvider,
    api_key: Optional[str],
    model: Optional[str] = None,
):
    """Set the active provider configuration."""
    global _cached_provider, _cached_model
    _cached_provider = provider
    _cached_model = model
    if api_key:
        config = PROVIDER_CONFIG[provider]
        _cached_api_keys[config["api_key_setting"]] = api_key


def get_active_provider() -> AIProvider:
    """Get the currently active AI provider."""
    return _cached_provider or AIProvider.GROQ


def get_active_model() -> str:
    """Get the currently active model name."""
    provider = get_active_provider()
    if _cached_model:
        return _cached_model
    return PROVIDER_CONFIG[provider]["default_model"]


def get_provider_info() -> dict:
    """Get config dict for the active provider."""
    provider = get_active_provider()
    config = dict(PROVIDER_CONFIG[provider])
    config["provider"] = provider.value
    config["active_model"] = get_active_model()
    return config


def is_ai_available(api_key: Optional[str] = None) -> bool:
    """Check if AI is configured and available."""
    if api_key:
        return True
    provider = get_active_provider()
    config = PROVIDER_CONFIG[provider]
    key = _cached_api_keys.get(config["api_key_setting"]) or os.environ.get("OPENAI_API_KEY")
    return bool(key)


def resolve_provider(
    chosen_provider_str: Optional[str],
    get_key_fn=None,
) -> tuple:
    """Resolve the best provider to use, with auto-fallback.

    If the chosen provider has no API key, tries all other providers
    to find one that does. This ensures AI features work whenever
    *any* provider is configured, even if the user hasn't explicitly
    selected it.

    Args:
        chosen_provider_str: The user's saved ai_provider setting value (or None).
        get_key_fn: Callable(setting_key) -> Optional[str] to look up a setting.
                    Typically partial of get_setting_value with a session.

    Returns:
        (provider: AIProvider, api_key: Optional[str])
    """
    # Parse the chosen provider
    provider_str = chosen_provider_str or "groq"
    try:
        chosen = AIProvider(provider_str)
    except ValueError:
        chosen = AIProvider.GROQ

    # Check the chosen provider first
    if get_key_fn:
        key = get_key_fn(PROVIDER_CONFIG[chosen]["api_key_setting"])
    else:
        key = _cached_api_keys.get(PROVIDER_CONFIG[chosen]["api_key_setting"])

    if key:
        return chosen, key

    # Fallback: check env var for OpenAI
    if chosen == AIProvider.OPENAI:
        env_key = os.environ.get("OPENAI_API_KEY")
        if env_key:
            return chosen, env_key

    # Fallback: scan all providers for any configured key
    for provider, config in PROVIDER_CONFIG.items():
        if provider == chosen:
            continue
        if get_key_fn:
            fallback_key = get_key_fn(config["api_key_setting"])
        else:
            fallback_key = _cached_api_keys.get(config["api_key_setting"])
        if fallback_key:
            logger.info(
                f"Provider '{chosen.value}' has no key; falling back to '{provider.value}'"
            )
            return provider, fallback_key

    # Also check OPENAI_API_KEY env var as last resort
    env_key = os.environ.get("OPENAI_API_KEY")
    if env_key:
        return AIProvider.OPENAI, env_key

    # Nothing configured
    return chosen, None


class BaseAIClient(ABC):
    """Abstract base class for AI provider clients."""

    @abstractmethod
    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
        json_mode: bool = False,
    ) -> str:
        """Send a chat completion request and return the response text."""
        ...

    @abstractmethod
    def vision_completion(
        self,
        prompt: str,
        image_data: bytes,
        image_type: str = "image/png",
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        """Send a vision request with an image and return the response text."""
        ...


class GroqClient(BaseAIClient):
    """Groq API client - OpenAI-compatible, free tier available."""

    def __init__(self, api_key: str):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
            timeout=30,
        )
        self.provider = AIProvider.GROQ

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
        json_mode: bool = False,
    ) -> str:
        model = model or get_active_model()
        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content.strip()

    def vision_completion(
        self,
        prompt: str,
        image_data: bytes,
        image_type: str = "image/png",
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        model = model or "meta-llama/llama-4-scout-17b-16e-instruct"
        b64 = base64.b64encode(image_data).decode("utf-8")
        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{image_type};base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=max_tokens,
            temperature=0.1,
        )
        return response.choices[0].message.content.strip()


class OpenAIClient(BaseAIClient):
    """OpenAI API client."""

    def __init__(self, api_key: str):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key, timeout=30)
        self.provider = AIProvider.OPENAI

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
        json_mode: bool = False,
    ) -> str:
        model = model or get_active_model()
        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content.strip()

    def vision_completion(
        self,
        prompt: str,
        image_data: bytes,
        image_type: str = "image/png",
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        model = model or "gpt-4o"
        b64 = base64.b64encode(image_data).decode("utf-8")
        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{image_type};base64,{b64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=max_tokens,
            temperature=0.1,
        )
        return response.choices[0].message.content.strip()


class ClaudeClient(BaseAIClient):
    """Anthropic Claude API client."""

    def __init__(self, api_key: str):
        from anthropic import Anthropic
        self.client = Anthropic(api_key=api_key)
        self.provider = AIProvider.CLAUDE

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
        json_mode: bool = False,
    ) -> str:
        model = model or get_active_model()

        # Extract system message (Claude requires system as a separate param)
        system_text = ""
        user_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_text += msg["content"] + "\n"
            else:
                user_messages.append({"role": msg["role"], "content": msg["content"]})

        if json_mode:
            system_text += "\n\nCRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks."

        system_text = system_text.strip()

        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": user_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if system_text:
            kwargs["system"] = system_text

        response = self.client.messages.create(**kwargs)
        return response.content[0].text.strip()

    def vision_completion(
        self,
        prompt: str,
        image_data: bytes,
        image_type: str = "image/png",
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        model = model or get_active_model()
        b64 = base64.b64encode(image_data).decode("utf-8")

        response = self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": image_type,
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        return response.content[0].text.strip()


class KimiClient(BaseAIClient):
    """Kimi (Moonshot AI) client - OpenAI-compatible API."""

    def __init__(self, api_key: str):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.moonshot.ai/v1",
            timeout=30,
        )
        self.provider = AIProvider.KIMI

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
        json_mode: bool = False,
    ) -> str:
        model = model or get_active_model()
        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content.strip()

    def vision_completion(
        self,
        prompt: str,
        image_data: bytes,
        image_type: str = "image/png",
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        raise NotImplementedError(
            "Kimi (Moonshot AI) does not support image/PDF parsing. "
            "Please switch to OpenAI, Claude, or Gemini for this feature."
        )


class GeminiClient(BaseAIClient):
    """Google Gemini API client."""

    def __init__(self, api_key: str):
        from google import genai
        self.client = genai.Client(api_key=api_key)
        self.genai = genai
        self.provider = AIProvider.GEMINI

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 1000,
        json_mode: bool = False,
    ) -> str:
        from google.genai import types

        model = model or get_active_model()

        # Combine system + user messages into parts
        system_text = ""
        user_text = ""
        for msg in messages:
            if msg["role"] == "system":
                system_text += msg["content"] + "\n"
            else:
                user_text += msg["content"] + "\n"

        config_kwargs: Dict[str, Any] = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        if json_mode:
            config_kwargs["response_mime_type"] = "application/json"

        config = types.GenerateContentConfig(
            system_instruction=system_text.strip() if system_text.strip() else None,
            **config_kwargs,
        )

        response = self.client.models.generate_content(
            model=model,
            contents=user_text.strip(),
            config=config,
        )
        return response.text.strip()

    def vision_completion(
        self,
        prompt: str,
        image_data: bytes,
        image_type: str = "image/png",
        model: Optional[str] = None,
        max_tokens: int = 4096,
    ) -> str:
        from google.genai import types

        model = model or get_active_model()

        image_part = types.Part.from_bytes(data=image_data, mime_type=image_type)

        config = types.GenerateContentConfig(
            max_output_tokens=max_tokens,
            temperature=0.1,
        )

        response = self.client.models.generate_content(
            model=model,
            contents=[prompt, image_part],
            config=config,
        )
        return response.text.strip()


def get_ai_client(
    provider: Optional[AIProvider] = None,
    api_key: Optional[str] = None,
) -> Optional[BaseAIClient]:
    """Factory function to create the appropriate AI client.

    Args:
        provider: Which provider to use. Defaults to active provider.
        api_key: API key override. Defaults to cached key or env var.

    Returns:
        An AI client instance, or None if no key is available.
    """
    provider = provider or get_active_provider()
    config = PROVIDER_CONFIG[provider]

    # Resolve API key
    key = api_key or _cached_api_keys.get(config["api_key_setting"])
    if not key and provider == AIProvider.OPENAI:
        key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None

    try:
        if provider == AIProvider.GROQ:
            return GroqClient(key)
        elif provider == AIProvider.OPENAI:
            return OpenAIClient(key)
        elif provider == AIProvider.CLAUDE:
            return ClaudeClient(key)
        elif provider == AIProvider.KIMI:
            return KimiClient(key)
        elif provider == AIProvider.GEMINI:
            return GeminiClient(key)
    except ImportError as e:
        logger.error(f"Missing package for {config['display_name']}: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to create {config['display_name']} client: {e}")
        return None

    return None
