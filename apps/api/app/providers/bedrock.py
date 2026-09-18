from __future__ import annotations

import asyncio
import json

import boto3

from .base import ModelProvider, ModelRequest, ModelResponse


class BedrockProvider(ModelProvider):
    """AWS Bedrock adapter.

    Source implementation does not imply account/model access. Live invocation must be
    verified separately against the configured AWS account, region, and model ID.
    """

    def __init__(self, region_name: str = "ap-south-1") -> None:
        self._client = boto3.client("bedrock-runtime", region_name=region_name)

    async def invoke(self, request: ModelRequest) -> ModelResponse:
        return await asyncio.to_thread(self._invoke_sync, request)

    def _invoke_sync(self, request: ModelRequest) -> ModelResponse:
        payload = {
            "messages": [
                {"role": "user", "content": [{"text": request.user_prompt}]}
            ],
            "system": [{"text": request.system_prompt}],
            "inferenceConfig": {"temperature": 0.2},
        }
        response = self._client.invoke_model(
            modelId=request.model_id,
            body=json.dumps(payload),
            contentType="application/json",
            accept="application/json",
        )
        body = json.loads(response["body"].read())
        text = body.get("output", {}).get("message", {}).get("content", [{}])[0].get("text", "")
        usage = body.get("usage", {})
        return ModelResponse(
            text=text,
            provider="aws-bedrock",
            model_id=request.model_id,
            input_tokens=usage.get("inputTokens"),
            output_tokens=usage.get("outputTokens"),
        )
