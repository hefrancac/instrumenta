"""Celery application and configuration."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

app = Celery("instrumenta", broker=settings.REDIS_URL, backend=settings.REDIS_URL,
             include=["worker.tasks"])

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_acks_late=True,                 # re-deliver if a worker dies mid-task
    worker_prefetch_multiplier=1,        # fair dispatch for slow scraping tasks
    task_time_limit=180,                 # hard kill after 3 min
    task_soft_time_limit=150,
    task_default_retry_delay=10,
    result_expires=3600,
)

# Periodic maintenance (enable a beat container to use these).
app.conf.beat_schedule = {
    "refresh-stale-cache": {
        "task": "worker.tasks.refresh_stale_cache",
        "schedule": 60 * 60 * 6,   # every 6h
    },
    "reap-stuck-jobs": {
        "task": "worker.tasks.reap_stuck_jobs",
        "schedule": 60 * 2,        # every 2 min — watchdog for dropped jobs
    },
}
