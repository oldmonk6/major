import os
from datetime import timedelta
from pathlib import Path
from typing import Optional

from minio import Minio
from minio.error import S3Error

from .config import get_settings

settings = get_settings()

# If no S3 endpoint is configured, fall back to local disk storage under ./uploads.
USE_LOCAL = not settings.s3_endpoint_url or settings.s3_endpoint_url == "local"
UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"

if not USE_LOCAL:
    s3_client = Minio(
        settings.s3_endpoint_url.replace("http://", "").replace("https://", ""),
        access_key=settings.s3_access_key_id,
        secret_key=settings.s3_secret_access_key,
        secure=settings.s3_endpoint_url.startswith("https"),
    )
    BUCKET = settings.s3_bucket
else:
    s3_client = None  # type: ignore
    BUCKET = "local"


def ensure_bucket() -> None:
    if USE_LOCAL:
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        return
    exists = s3_client.bucket_exists(BUCKET)
    if not exists:
        s3_client.make_bucket(BUCKET)


def put_object_from_fileobj(obj, name: str, content_type: str) -> str:
    if USE_LOCAL:
        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        target = UPLOAD_ROOT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "wb") as f:
            f.write(obj.read())
        # return a file path; in production you might serve via static or signed URLs
        return str(target)
    s3_client.put_object(
        BUCKET, name, obj, length=-1, part_size=10 * 1024 * 1024, content_type=content_type
    )
    return f"{settings.s3_endpoint_url}/{BUCKET}/{name}"


def presigned_get(name: str, expiry: int = 3600) -> Optional[str]:
    if USE_LOCAL:
        target = UPLOAD_ROOT / name
        return str(target) if target.exists() else None
    try:
        return s3_client.presigned_get_object(BUCKET, name, expires=timedelta(seconds=expiry))
    except S3Error:
        return None
