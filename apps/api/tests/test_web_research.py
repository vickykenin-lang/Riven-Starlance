import asyncio

from app.web_research import MultiProviderWebResearchAdapter, WebResearchAdapter, WebSource


class StubAdapter(WebResearchAdapter):
    def __init__(self, name: str, *, fail: bool = False) -> None:
        self.name = name
        self.fail = fail
        self.calls: list[tuple[str, str | None]] = []

    async def search(self, query: str, *, limit: int = 8, agent_id: str | None = None) -> list[WebSource]:
        self.calls.append((query, agent_id))
        if self.fail:
            raise RuntimeError(f"{self.name} unavailable")
        return [
            WebSource(
                title=f"{self.name} result",
                url=f"https://{self.name}.example/result",
                snippet="test evidence",
                provider=self.name,
            )
        ]


def test_multi_provider_routes_agents_to_preferred_search_provider():
    async def scenario():
        tavily = StubAdapter("tavily")
        exa = StubAdapter("exa")
        adapter = MultiProviderWebResearchAdapter({"tavily": tavily, "exa": exa})

        r1 = await adapter.search("query one", agent_id="researcher-1")
        r2 = await adapter.search("query two", agent_id="researcher-2")
        r3 = await adapter.search("query three", agent_id="researcher-3")
        r4 = await adapter.search("query four", agent_id="researcher-4")

        assert r1[0].provider == "tavily"
        assert r2[0].provider == "exa"
        assert r3[0].provider == "tavily"
        assert r4[0].provider == "exa"
        assert [agent_id for _, agent_id in tavily.calls] == ["researcher-1", "researcher-3"]
        assert [agent_id for _, agent_id in exa.calls] == ["researcher-2", "researcher-4"]

    asyncio.run(scenario())


def test_multi_provider_falls_back_when_preferred_provider_fails():
    async def scenario():
        tavily = StubAdapter("tavily", fail=True)
        exa = StubAdapter("exa")
        adapter = MultiProviderWebResearchAdapter({"tavily": tavily, "exa": exa})

        results = await adapter.search("fallback query", agent_id="researcher-1")

        assert results[0].provider == "exa"
        assert len(tavily.calls) == 1
        assert len(exa.calls) == 1

    asyncio.run(scenario())
