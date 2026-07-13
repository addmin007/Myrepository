"""
backend/app/tasks/celery_app.py
Celery 应用初始化
"""
from celery import Celery
from app.core.config import get_settings

_s = get_settings()

celery_app = Celery(
    "mof_worker",
    broker=_s.REDIS_URL,
    backend=_s.REDIS_URL,
    include=["app.tasks.inference"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_soft_time_limit=_s.TASK_SOFT_TIME_LIMIT,
    task_time_limit=_s.TASK_HARD_TIME_LIMIT,
    worker_prefetch_multiplier=1,          # AI 推理任务重，不预取
    task_acks_late=True,                   # worker 崩溃时任务重入队列
    task_reject_on_worker_lost=True,
    result_expires=3600,                   # 结果在 Redis 保留 1h
    # macOS: MPS / PyTorch 不支持 fork，使用 solo pool 避免子进程锁死
    # 生产环境 Linux 上改为 prefork（默认）
    worker_pool="solo",
)
