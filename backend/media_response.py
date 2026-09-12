"""Download e streaming con byte-range anche sulle versioni Starlette precedenti."""
import re
from pathlib import Path

from fastapi import Request
from fastapi.responses import FileResponse, Response, StreamingResponse


def _chunks(path: Path, start: int, length: int):
    with path.open("rb") as source:
        source.seek(start)
        while length:
            data = source.read(min(length, 512 * 1024))
            if not data:
                break
            length -= len(data)
            yield data


def ranged_file_response(path: Path, request: Request, media_type: str, disposition: str):
    """Conserva HEAD, download, ETag e ripresa condizionale senza caricare il file in RAM."""
    stat = path.stat()
    full = FileResponse(
        path, media_type=media_type, filename=path.name,
        content_disposition_type=disposition, stat_result=stat,
        headers={"Accept-Ranges": "bytes"},
    )
    if request.method == "HEAD":
        return Response(headers=dict(full.headers))
    byte_range = request.headers.get("range")
    if_range = request.headers.get("if-range")
    if not byte_range or (if_range and if_range not in (
        full.headers["etag"], full.headers["last-modified"],
    )):
        return full
    # Il server può ignorare richieste multi-range e unità non supportate.
    if "," in byte_range or not byte_range.startswith("bytes="):
        return full
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", byte_range.strip())
    try:
        if not match or not any(match.groups()):
            raise ValueError("Intervallo non valido")
        left, right = match.groups()
        if left:
            start = int(left)
            end = min(int(right), stat.st_size - 1) if right else stat.st_size - 1
        else:
            suffix = int(right)
            start, end = max(0, stat.st_size - suffix), stat.st_size - 1
        if not 0 <= start <= end < stat.st_size:
            raise ValueError("Intervallo fuori dal file")
    except ValueError:
        return Response(status_code=416, headers={
            "Content-Range": f"bytes */{stat.st_size}", "Accept-Ranges": "bytes",
        })
    headers = dict(full.headers)
    # FileResponse normalizza i nomi in minuscolo: aggiorna le stesse chiavi
    # per non emettere due Content-Length con valori discordanti.
    headers.update({"content-range": f"bytes {start}-{end}/{stat.st_size}",
                    "content-length": str(end - start + 1)})
    return StreamingResponse(_chunks(path, start, end - start + 1),
                             status_code=206, headers=headers)