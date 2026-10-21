import math
from collections import OrderedDict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request

from app.core.settings import get_runtime_settings


class AuthLimiter:
    """A bounded per-process sliding window; shared deployments need an edge limit too."""

    def __init__(self) -> None:
        self.buckets: OrderedDict[str, deque[float]] = OrderedDict()
        self.lock = Lock()

    def check(self, key: str, maximum: int) -> None:
        now = monotonic()
        with self.lock:
            while self.buckets:
                first = next(iter(self.buckets))
                if self.buckets[first] and self.buckets[first][-1] > now - 60:
                    break
                self.buckets.popitem(last=False)
            bucket = self.buckets.setdefault(key, deque())
            self.buckets.move_to_end(key)
            while bucket and bucket[0] <= now - 60:
                bucket.popleft()
            if len(bucket) >= maximum:
                raise HTTPException(
                    429,
                    "Too many authentication attempts",
                    headers={
                        "Retry-After": str(max(1, math.ceil(60 - (now - bucket[0]))))
                    },
                )
            bucket.append(now)
            if len(self.buckets) > 10000:
                self.buckets.popitem(last=False)


def limit_auth(request: Request) -> None:
    address = request.client.host if request.client else "unknown"
    request.app.state.auth_limiter.check(
        address, get_runtime_settings().auth_rate_limit
    )
