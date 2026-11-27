"""One JSON event per HTTP response, collected by the existing ECS awslogs driver."""

import json
import logging
import sys
from time import perf_counter

logger = logging.getLogger("app.telemetry")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


class RequestTelemetryMiddleware:
    def __init__(self, app, api_prefix: str):
        self.app = app
        self.api_prefix = api_prefix.rstrip("/") + "/"

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = perf_counter()
        status = 500
        emitted = False

        def emit():
            nonlocal emitted
            if emitted:
                return
            emitted = True
            # Route template only: never log raw URLs, IDs, query strings or bodies.
            route = getattr(scope.get("route"), "path", "unmatched")
            logger.info(json.dumps({
                "event": "http_request",
                "api_request": int(scope.get("path", "").startswith(self.api_prefix)),
                "route": route,
                "status_code": status,
                "status_class": f"{status // 100}xx",
                "duration_ms": round((perf_counter() - started) * 1000, 3),
            }))

        async def tracked(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                emit()

        try:
            await self.app(scope, receive, tracked)
        finally:
            emit()
