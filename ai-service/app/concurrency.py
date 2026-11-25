from __future__ import annotations

import asyncio
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import TypeVar

from fastapi import HTTPException

T = TypeVar("T")


class PriorityExecutors:
    """Separates emergency identification traffic from general AI inference traffic."""

    def __init__(self, max_workers_per_pool: int = 2, max_queue_per_pool: int = 16) -> None:
        self.emergency_pool = ThreadPoolExecutor(
            max_workers=max_workers_per_pool, thread_name_prefix="ai-emerg"
        )
        self.general_pool = ThreadPoolExecutor(
            max_workers=max_workers_per_pool, thread_name_prefix="ai-gen"
        )
        self._emergency_sem = asyncio.Semaphore(max_queue_per_pool)
        self._general_sem = asyncio.Semaphore(max_queue_per_pool)

    async def run(
        self,
        priority: str,
        fn: Callable[..., T],
        *args: object,
        **kwargs: object,
    ) -> T:
        is_emergency = priority.lower() == "emergency"
        sem = self._emergency_sem if is_emergency else self._general_sem
        pool = self.emergency_pool if is_emergency else self.general_pool

        try:
            await asyncio.wait_for(sem.acquire(), timeout=0.05)
        except TimeoutError as exc:
            raise HTTPException(status_code=503, headers={"Retry-After": "1"}) from exc

        try:
            loop = asyncio.get_running_loop()
            bound = partial(fn, *args, **kwargs)
            return await loop.run_in_executor(pool, bound)
        finally:
            sem.release()

    def shutdown(self) -> None:
        self.emergency_pool.shutdown(wait=False)
        self.general_pool.shutdown(wait=False)
