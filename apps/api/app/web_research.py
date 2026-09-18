from __future__ import annotations

import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field


class WebSource(BaseModel):
    title: str
    url: str
    snippet: str = ""
    provider: str
    source_type: str = "web"
    is_primary: bool = False
    domain: str | None = None
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, object] = Field(default_factory=dict)


class WebResearchAdapter(ABC):
    name: str

    @property
    def enabled(self) -> bool:
        return True

    @abstractmethod
    async def search(self, query: str, *, limit: int = 8) -> list[WebSource]:
        raise NotImplementedError


class DisabledWebResearchAdapter(WebResearchAdapter):
    name = "disabled"

    @property
    def enabled(self) -> bool:
        return False

    async def search(self, query: str, *, limit: int = 8) -> list[WebSource]:
        return []


class BraveWebResearchAdapter(WebResearchAdapter):
    name = "brave-search"

    def __init__(self, api_key: str, endpoint: str = "https://api.search.brave.com/res/v1/web/search") -> None:
        self.api_key = api_key
        self.endpoint = endpoint

    async def search(self, query: str, *, limit: int = 8) -> list[WebSource]:
        count = max(1, min(limit, 20))
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key,
        }
        params = {"q": query, "count": count, "safesearch": "moderate"}
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(self.endpoint, headers=headers, params=params)
            response.raise_for_status()
            payload = response.json()

        results = payload.get("web", {}).get("results", [])
        sources: list[WebSource] = []
        for item in results[:count]:
            url = str(item.get("url") or "").strip()
            if not url:
                continue
            domain = urlparse(url).hostname
            sources.append(
                WebSource(
                    title=str(item.get("title") or url),
                    url=url,
                    snippet=str(item.get("description") or ""),
                    provider=self.name,
                    domain=domain,
                    metadata={
                        "age": item.get("age"),
                        "language": item.get("language"),
                        "family_friendly": item.get("family_friendly"),
                    },
                )
            )
        return sources


def load_web_research_adapter() -> WebResearchAdapter:
    provider = os.getenv("RIVEN_WEB_SEARCH_PROVIDER", "disabled").strip().lower()
    if provider in {"", "disabled", "off", "none"}:
        return DisabledWebResearchAdapter()
    if provider == "brave":
        api_key = os.getenv("RIVEN_WEB_SEARCH_API_KEY", "").strip()
        if not api_key:
            return DisabledWebResearchAdapter()
        endpoint = os.getenv("RIVEN_WEB_SEARCH_ENDPOINT", "https://api.search.brave.com/res/v1/web/search").strip()
        return BraveWebResearchAdapter(api_key=api_key, endpoint=endpoint)
    return DisabledWebResearchAdapter()
