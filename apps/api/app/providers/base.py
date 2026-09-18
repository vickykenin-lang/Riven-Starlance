from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(slots=True)
class ModelRequest:
    system_prompt: str
    user_prompt: str
    model_id: str


@dataclass(slots=True)
class ModelResponse:
    text: str
    provider: str
    model_id: str
    input_tokens: int | None = None
    output_tokens: int | None = None


class ModelProvider(ABC):
    @abstractmethod
    async def invoke(self, request: ModelRequest) -> ModelResponse:
        raise NotImplementedError
