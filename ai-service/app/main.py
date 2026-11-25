from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.assistant.llm import LlmClientPort, build_llm_client
from app.assistant.pipeline import AssistantPipeline
from app.assistant.red_flags import RedFlagEngine
from app.clinical.refdata import RefDataStore
from app.concurrency import PriorityExecutors
from app.config import Settings, get_settings
from app.face.models import FaceInferenceBackend, UnloadedOnnxBackend, verify_model_checksums
from app.face.pipeline import FacePipeline
from app.face.transform import TemplateTransform
from app.logging import configure_logging
from app.routers.assistant import router as assistant_router
from app.routers.clinical import router as clinical_router
from app.routers.face import router as face_router
from app.routers.fingerprint import router as fingerprint_router
from app.routers.health import router as health_router


async def _init_app_state(
    app: FastAPI,
    settings: Settings,
    *,
    face_backend: FaceInferenceBackend | None = None,
    llm_client: LlmClientPort | None = None,
) -> asyncio.Task[None] | None:
    if settings.verify_model_checksums:
        verify_model_checksums(settings.models_dir)

    backend = face_backend or UnloadedOnnxBackend(settings.models_dir)
    transform = TemplateTransform.from_env(settings)
    refstore = await RefDataStore.load(settings.database_url_ai_ref, settings.dataset_version)
    red_flags = RedFlagEngine.from_yaml(settings.red_flags_path)
    llm = llm_client or build_llm_client(settings)

    app.state.settings = settings
    app.state.transform = transform
    app.state.face = FacePipeline(settings=settings, backend=backend, transform=transform)
    app.state.face_loaded = backend.models_loaded
    app.state.refdata = refstore
    app.state.dataset_version = refstore.snapshot.dataset_version
    app.state.red_flags = red_flags
    app.state.llm = llm
    app.state.assistant = AssistantPipeline(
        red_flags=red_flags,
        llm=llm,
        refdata=refstore.snapshot,
    )
    app.state.executors = PriorityExecutors()

    if settings.database_url_ai_ref:
        return asyncio.create_task(refstore.refresh_every(settings.database_url_ai_ref, 600))
    return None


def create_app(
    settings_override: Settings | None = None,
    *,
    face_backend: FaceInferenceBackend | None = None,
    llm_client: LlmClientPort | None = None,
) -> FastAPI:
    settings = settings_override or get_settings()
    configure_logging("INFO" if settings.app_env == "production" else "DEBUG")

    @asynccontextmanager
    async def lifespan(app_instance: FastAPI) -> AsyncIterator[None]:
        refresher = await _init_app_state(
            app_instance,
            settings,
            face_backend=face_backend,
            llm_client=llm_client,
        )
        try:
            yield
        finally:
            if refresher is not None:
                refresher.cancel()
            executors: PriorityExecutors | None = getattr(app_instance.state, "executors", None)
            if executors is not None:
                executors.shutdown()

    app = FastAPI(
        title="SmartHealth AI Service",
        version=settings.app_version,
        docs_url=None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.include_router(health_router, prefix="/internal/v1")
    app.include_router(face_router, prefix="/internal/v1")
    app.include_router(clinical_router, prefix="/internal/v1")
    app.include_router(assistant_router, prefix="/internal/v1")
    app.include_router(fingerprint_router, prefix="/internal/v1")
    return app


app = create_app()
