from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class LocalizedText(BaseModel):
    model_config = ConfigDict(extra="forbid")

    en: str
    ar: str


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
