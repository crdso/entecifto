"""Import ENTEC photos to R2 and write a public gallery.json manifest.

Run from this directory after installing requirements-gallery.txt:
    python import_gallery.py

The source photos are only read. Object keys depend on both relative path and
file contents, so a rerun skips existing objects and a changed photo gets a new ID.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import mimetypes
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote, urlsplit

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent  # raiz do projeto
DEFAULT_PHOTOS = ROOT.parent / "Fotos ENTEC 2026"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".avif"}
CHUNK_SIZE = 1024 * 1024


@dataclass
class Result:
    path: Path
    entry: dict | None = None
    original_uploaded: bool = False
    thumbnail_uploaded: bool = False
    bytes_uploaded: int = 0
    error: str | None = None


def read_env(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise FileNotFoundError(f"Arquivo de credenciais não encontrado: {path}")
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    required = ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET", "R2_PUBLIC_URL")
    missing = [key for key in required if not values.get(key)]
    if missing:
        raise ValueError(f"Variáveis ausentes em {path.name}: {', '.join(missing)}")
    endpoint = urlsplit(values["R2_ENDPOINT"])
    if endpoint.scheme not in {"http", "https"} or not endpoint.netloc or endpoint.path.strip("/") or endpoint.query or endpoint.fragment:
        raise ValueError("R2_ENDPOINT deve conter apenas o domínio, sem o nome do bucket no caminho")
    if not values["R2_PUBLIC_URL"].startswith(("http://", "https://")):
        raise ValueError("R2_PUBLIC_URL precisa começar com http:// ou https://")
    return values


def photo_id(path: Path, source: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.relative_to(source).as_posix().encode("utf-8"))
    digest.update(b"\0")
    with path.open("rb") as original:
        for chunk in iter(lambda: original.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def exists(client, bucket: str, key: str) -> bool:
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as exc:
        code = str(exc.response.get("Error", {}).get("Code", ""))
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if code in {"404", "NoSuchKey", "NotFound"} or status == 404:
            return False
        raise


def thumbnail(path: Path) -> tuple[bytes, int, int]:
    with Image.open(path) as image:
        oriented = ImageOps.exif_transpose(image)
        width, height = oriented.size
        oriented.thumbnail((800, 800), Image.Resampling.LANCZOS)
        if oriented.mode not in {"RGB", "RGBA"}:
            oriented = oriented.convert("RGBA" if "A" in oriented.getbands() else "RGB")
        output = io.BytesIO()
        save_options = {"format": "WEBP", "quality": 82, "method": 4}
        if icc_profile := image.info.get("icc_profile"):
            save_options["icc_profile"] = icc_profile
        oriented.save(output, **save_options)
        return output.getvalue(), width, height


def public_url(base: str, key: str) -> str:
    return f"{base.rstrip('/')}/{quote(key, safe='/')}"


def process_photo(path: Path, source: Path, client, bucket: str, public_base: str) -> Result:
    result = Result(path=path)
    try:
        identifier = photo_id(path, source)
        original_key = f"{bucket}/originals/{identifier}/{path.name}"
        thumb_key = f"{bucket}/thumbs/{identifier}.webp"
        original_exists = exists(client, bucket, original_key)
        thumb_exists = exists(client, bucket, thumb_key)

        # Validate and orient every photo, including those already on R2, before
        # placing it in the manifest. Originals are never rewritten or modified.
        thumb_bytes, width, height = thumbnail(path)

        if not original_exists:
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            client.upload_file(str(path), bucket, original_key, ExtraArgs={"ContentType": content_type})
            result.original_uploaded = True
            result.bytes_uploaded += path.stat().st_size
        if not thumb_exists:
            client.put_object(Bucket=bucket, Key=thumb_key, Body=thumb_bytes, ContentType="image/webp")
            result.thumbnail_uploaded = True
            result.bytes_uploaded += len(thumb_bytes)

        result.entry = {
            "id": identifier,
            "filename": path.name,
            "original": public_url(public_base, original_key),
            "thumbnail": public_url(public_base, thumb_key),
            "width": width,
            "height": height,
        }
    except Exception as exc:  # Keep importing after a per-photo failure.
        result.error = f"{type(exc).__name__}: {exc}"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa fotos da ENTEC para o Cloudflare R2.")
    parser.add_argument("--photos", type=Path, default=DEFAULT_PHOTOS, help="Pasta de fotos (recursiva)")
    parser.add_argument("--env-file", type=Path, default=ROOT / ".r2.env", help="Credenciais R2")
    parser.add_argument("--output", type=Path, default=ROOT / "site" / "gallery.json", help="Manifesto público")
    parser.add_argument("--workers", type=int, default=3, help="Uploads simultâneos (padrão: 3)")
    parser.add_argument("--limit", type=int, help="Importa somente as primeiras N imagens, para conferência")
    args = parser.parse_args()
    if args.workers < 1 or args.workers > 8:
        parser.error("--workers deve estar entre 1 e 8")
    if args.limit is not None and args.limit < 1:
        parser.error("--limit deve ser positivo")
    source = args.photos.resolve()
    if not source.is_dir():
        parser.error(f"Pasta de fotos não encontrada: {source}")
    photos = sorted(
        (path for path in source.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS),
        key=lambda path: path.relative_to(source).as_posix().casefold(),
    )
    if args.limit:
        photos = photos[: args.limit]
    if not photos:
        parser.error("Nenhuma imagem encontrada")
    try:
        env = read_env(args.env_file)
    except (FileNotFoundError, ValueError) as exc:
        parser.error(str(exc))

    client = boto3.client(
        "s3",
        endpoint_url=env["R2_ENDPOINT"],
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"mode": "standard", "max_attempts": 5},
                      max_pool_connections=args.workers * 3, s3={"addressing_style": "path"}),
    )
    print(f"Imagens encontradas: {len(photos)} | concorrência: {args.workers}", flush=True)
    completed: list[Result] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_photo, photo, source, client, env["R2_BUCKET"], env["R2_PUBLIC_URL"]): photo for photo in photos}
        for index, future in enumerate(as_completed(futures), 1):
            result = future.result()
            completed.append(result)
            status = "FALHOU" if result.error else ("ENVIADA" if result.original_uploaded or result.thumbnail_uploaded else "JÁ EXISTE")
            detail = f" — {result.error}" if result.error else ""
            print(f"[{index}/{len(photos)}] {status}: {result.path.relative_to(source)}{detail}", flush=True)

    entries = [result.entry for result in sorted(completed, key=lambda item: item.path.relative_to(source).as_posix().casefold()) if result.entry]
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    temporary.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, output)
    originals = sum(result.original_uploaded for result in completed)
    thumbnails = sum(result.thumbnail_uploaded for result in completed)
    failures = sum(bool(result.error) for result in completed)
    uploaded = sum(result.bytes_uploaded for result in completed)
    print(f"RESUMO: encontradas={len(photos)} originals_enviados={originals} thumbnails_enviados={thumbnails} "
          f"falhas={failures} bytes_enviados={uploaded} ({uploaded / 1024**2:.1f} MiB) gallery={len(entries)}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
