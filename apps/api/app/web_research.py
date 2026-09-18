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

    @property
    def providers(self) -> list[str]:
        return [self.name] if self.enabled else []

    @abstractmethod
    async def search(self, query: str, *, limit: int = 8, agent_id: str | None = None) -> list[WebSource]:
        raise NotImplementedError


class DisabledWebResearchAdapter(WebResearchAdapter):
    name = "disabled"

    @property
    def enabled(self) -> bool:
        return False

    async def search(self, query: str, *, limit: int = 8, agent_id: str | None = None) -> list[WebSource]:
        return []


class BraveWebResearchAdapter(WebResearchAdapter):
    name = "brave-search"

    def __init__(self, api_key: str, endpoint: str = "https://api.search.brave.com/res/v1/web/search") -> None:
        self.api_key = api_key
        self.endpoint = endpoint

    async def search(self, query: str, *, limit: int = 8, agent_id: str | None = None) -> list[WebSource]:
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
            sources.append(
                WebSource(
                    title=str(item.get("title") or url),
                    url=url,
                    snippet=str(item.get("description") or ""),
                    provider=self.name,
                    domain=urlparse(url).hostname,
                    metadata={"age": item.get("age"), "language": item.get("language")},
                )
            )
        return sources


class TavilyWebResearchAdapter(WebResearchAdapter):
    name = "tavily"

    def __init__(self, api_key: str, endpoint: str = "https://api.tavily.com/search") -> None:
        self.api_key = api_key
        self.endpoint = endpoint

    async def search(self, query: str, *, limit: int = 8, agent_id: str | None = None) -> list[WebSource]:
        count = max(1, min(limit, 20))
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        body = {
            "query": query,
            "search_depth": "basic",
            "max_results": count,
            "include_answer": False,
            "include_raw_content": False,
        }
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            response = await client.post(self.endpoint, headers=headers, json=body)
            response.raise_for_status()
            payload = response.json()

        sources: list[WebSource] = []
        for item in payload.get("results", [])[:count]:
            url = str(item.get("url") or "").strip()
            if not url:
                continue
            sources.append(
                WebSource(
                    title=str(item.get("title") or url),
                    url=url,
                    snippet=str(item.get("content") or ""),
                    provider=self.name,
                    domain=urlparse(url).hostname,
                    metadata={"score": item.get("score"), "published_date": item.get("published_date")},
                )
            )
        return sources


class ExaWebResearchAdapter(WebResearchAdapter):
    name = "exa"

    def __init__(self, api_key: str, endpoint: str = "https://api.exa.ai/search") -> None:
        self.api_key = api_key
        self.endpoint = endpoint

    async def search(self, query: str, *, limit: int = 8, agent_id: str | None = None) -> list[WebSource]:
        count = max(1, min(limit, 20))
        headers = {"x-api-key": self.api_key, "Content-Type": "application/json"}
        body = {
            "query": query,
            "type": "auto",
            "numResults": count,
            "contents": {"highlights": True},
        }
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            response = await client.post(self.endpoint, headers=headers, json=body)
            response.raise_for_status()
            payload = response.json()

        sources: list[WebSource] = []
        for item in payload.get("results", [])[:count]:
            url = str(item.get("url") or "").strip()
            if not url:
                continue
            highlights = item.get("highlights") or []
            snippet = "\n".join(str(value) for value in highlights if value)
            if not snippet:
                snippet = str(item.get("text") or item.get("summary") or "")
            sources.append(
                WebSource(
                    title=str(item.get("title") or url),
                    url=url,
                    snippet=snippet,
                    provider=self.name,
                    domain=urlparse(url).hostname,
                    metadata={
                        "published_date": item.get("publishedDate"),
                        "author": item.get("author"),
                        "score": item.get("score"),
                    },
                )
            )
        return sources


class MultiProviderWebResearchAdapter(WebResearchAdapter):
    name = "multi-provider"

    def __init__(self, adapters: dict[str, WebResearchAdapter]) -> None:
        self.adapters = {name: adapter for name, adapter in adapters.items() if adapter.enabled}
        self.preferences = {
            "researcher-1": ("tavily", "exa", "brave"),
            "researcher-2": ("exa", "tavily", "brave"),
            "researcher-3": ("tavily", "exa", "brave"),
            "researcher-4": ("exa", "tavily", "brave"),
        }

    @property
    def enabled(self) -> bool:
        return bool(self.adapters)

    @property
    def providers(self) -> list[str]:
        return list(self.adapters.keys())

    async def search(self, query: str, *, limit: int = 8, agent_id: str | None = None) -> list[WebSource]:
        preference = self.preferences.get(agent_id or "", tuple(self.adapters.keys()))
        ordered = [name for name in preference if name in self.adapters]
        ordered.extend(name for name in self.adapters if name not in ordered)
        errors: list[str] = []
        for name in ordered:
            try:
                results = await self.adapters[name].search(query, limit=limit, agent_id=agent_id)
                if results:
                    for source in results:
                        source.metadata["preferred_for_agent"] = agent_id or "generic"
                    return results
            except Exception as exc:
                errors.append(f"{name}: {type(exc).__name__}: {exc}")
        if errors:
            raise RuntimeError("All configured web providers failed: " + " | ".join(errors))
        return []


def load_web_research_adapter() -> WebResearchAdapter:
    provider = os.getenv("RIVEN_WEB_SEARCH_PROVIDER", "disabled").strip().lower()
    if provider in {"", "disabled", "off", "none"}:
        return DisabledWebResearchAdapter()

    tavily_key = os.getenv("RIVEN_TAVILY_API_KEY", "").strip()
    exa_key = os.getenv("RIVEN_EXA_API_KEY", "").strip()
    brave_key = os.getenv("RIVEN_BRAVE_API_KEY", "").strip() or os.getenv("RIVEN_WEB_SEARCH_API_KEY", "").strip()

    adapters: dict[str, WebResearchAdapter] = {}
    if tavily_key:
        adapters["tavily"] = TavilyWebResearchAdapter(
            api_key=tavily_key,
            endpoint=os.getenv("RIVEN_TAVILY_ENDPOINT", "https://api.tavily.com/search").strip(),
        )
    if exa_key:
        adapters["exa"] = ExaWebResearchAdapter(
            api_key=exa_key,
            endpoint=os.getenv("RIVEN_EXA_ENDPOINT", "https://api.exa.ai/search").strip(),
        )
    if brave_key:
        adapters["brave"] = BraveWebResearchAdapter(
            api_key=brave_key,
            endpoint=os.getenv("RIVEN_WEB_SEARCH_ENDPOINT", "https://api.search.brave.com/res/v1/web/search").strip(),
        )

    if provider in {"multi", "multi-provider", "auto"}:
        return MultiProviderWebResearchAdapter(adapters) if adapters else DisabledWebResearchAdapter()
    if provider == "tavily" and "tavily" in adapters:
        return adapters["tavily"]
    if provider == "exa" and "exa" in adapters:
        return adapters["exa"]
    if provider == "brave" and "brave" in adapters:
        return adapters["brave"]
    return DisabledWebResearchAdapter()
