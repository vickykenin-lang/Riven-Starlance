from __future__ import annotations

from abc import ABC, abstractmethod
from pydantic import BaseModel, Field


class WebSource(BaseModel):
    title: str
    url: str
    snippet: str = ""
    provider: str
    metadata: dict[str, object] = Field(default_factory=dict)


class WebResearchAdapter(ABC):
    """Provider-independent contract for future live web research integrations."""

    name: str

    @abstractmethod
    async def search(self, query: str, *, limit: int = 8) -> list[WebSource]:
        raise NotImplementedError


class DisabledWebResearchAdapter(WebResearchAdapter):
    name = "disabled"

    async def search(self, query: str, *, limit: int = 8) -> list[WebSource]:
        return []


web_research: WebResearchAdapter = DisabledWebResearchAdapter()
