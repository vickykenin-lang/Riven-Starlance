from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import AsyncIterator
from uuid import UUID

from .models import AgentEvent


class EventBus:
    def __init__(self) -> None:
        self._history: dict[UUID, list[AgentEvent]] = defaultdict(list)
        self._subscribers: dict[UUID, set[asyncio.Queue[AgentEvent]]] = defaultdict(set)

    async def publish(self, event: AgentEvent) -> None:
        self._history[event.run_id].append(event)
        for queue in tuple(self._subscribers[event.run_id]):
            await queue.put(event)

    def history(self, run_id: UUID) -> list[AgentEvent]:
        return list(self._history.get(run_id, []))

    async def subscribe(self, run_id: UUID) -> AsyncIterator[AgentEvent]:
        queue: asyncio.Queue[AgentEvent] = asyncio.Queue()
        self._subscribers[run_id].add(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            self._subscribers[run_id].discard(queue)


event_bus = EventBus()
