from __future__ import annotations

import struct
from dataclasses import dataclass

MAX_FRAME_BYTES = 300 * 1024
MIN_SHORT_SIDE = 320
MAX_LONG_SIDE = 4096


class ImageValidationError(ValueError):
    def __init__(self, detail: str, status_code: int = 400) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


@dataclass(frozen=True, slots=True)
class DecodedFrameInfo:
    format: str
    width: int
    height: int
    raw_bytes: bytes


def _jpeg_dimensions(data: bytes) -> tuple[int, int]:
    idx = 2
    length = len(data)
    while idx + 4 < length:
        if data[idx] != 0xFF:
            idx += 1
            continue
        marker = data[idx + 1]
        idx += 2
        if marker in (0xD8, 0xD9, 0x01) or (0xD0 <= marker <= 0xD7):
            continue
        if idx + 2 > length:
            break
        seg_len = struct.unpack(">H", data[idx : idx + 2])[0]
        if seg_len < 2 or idx + seg_len > length:
            break
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            if idx + 7 > length:
                break
            height, width = struct.unpack(">HH", data[idx + 3 : idx + 7])
            return width, height
        idx += seg_len
    raise ImageValidationError("malformed_jpeg_headers", status_code=400)


def _png_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[12:16] != b"IHDR":
        raise ImageValidationError("malformed_png_headers", status_code=400)
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def validate_and_inspect_frame(raw: bytes) -> DecodedFrameInfo:
    if len(raw) > MAX_FRAME_BYTES:
        raise ImageValidationError("frame_too_large", status_code=413)
    if len(raw) < 12:
        raise ImageValidationError("empty_or_truncated_image", status_code=400)

    if raw[:3] == b"\xff\xd8\xff":
        fmt = "jpeg"
        width, height = _jpeg_dimensions(raw)
    elif raw[:8] == b"\x89PNG\r\n\x1a\n":
        fmt = "png"
        width, height = _png_dimensions(raw)
    else:
        raise ImageValidationError("unsupported_image_format", status_code=400)

    shortest = min(width, height)
    longest = max(width, height)
    if longest > MAX_LONG_SIDE:
        raise ImageValidationError("image_resolution_exceeds_limit", status_code=400)
    if shortest < MIN_SHORT_SIDE:
        raise ImageValidationError("too_small", status_code=422)

    return DecodedFrameInfo(format=fmt, width=width, height=height, raw_bytes=raw)
