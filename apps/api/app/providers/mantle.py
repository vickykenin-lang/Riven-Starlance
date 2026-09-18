from __future__ import annotations

import httpx

from .base import ModelProvider, ModelRequest, ModelResponse


class BedrockMantleProvider(ModelProvider):
    """OpenAI-compatible Amazon Bedrock Mantle adapter.

    Credentials are supplied at runtime through environment configuration. Source
    implementation alone does not prove credential validity or model availability;
    those are verified separately with live requests.
    """

    name = "bedrock-mantle"

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://bedrock-mantle.ap-south-1.api.aws/v1",
    ) -> None:
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")

    async def invoke(self, request: ModelRequest) -> ModelResponse:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": request.model_id,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            "temperature": 0.2,
        }
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            body = response.json()

        choices = body.get("choices") or []
        message = choices[0].get("message", {}) if choices else {}
        content = message.get("content") or ""
        usage = body.get("usage") or {}
        return ModelResponse(
            text=str(content),
            provider=self.name,
            model_id=str(body.get("model") or request.model_id),
            input_tokens=usage.get("prompt_tokens"),
            output_tokens=usage.get("completion_tokens"),
        )

    async def list_models(self) -> list[str]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(f"{self.base_url}/models", headers=headers)
            response.raise_for_status()
            body = response.json()
        return [str(item.get("id")) for item in body.get("data", []) if item.get("id")]
