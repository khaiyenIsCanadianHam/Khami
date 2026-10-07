"""Validated public contract; all numerical results come from the engine."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ConnectionRequest(StrictModel):
    type: Literal["postgresql", "mysql", "sqlite"]
    host: str = Field(default="", max_length=255)
    port: int | None = Field(default=None, ge=1, le=65535)
    database: str = Field(min_length=1, max_length=1024)
    username: str = Field(default="", max_length=255)
    password: SecretStr = Field(default_factory=lambda: SecretStr(""))

    @field_validator("port", mode="before")
    @classmethod
    def optional_port(cls, value):
        return None if value == "" else value

    @model_validator(mode="after")
    def require_host(self):
        if self.type != "sqlite" and not self.host.strip():
            raise ValueError("A server address is required.")
        if not self.database.strip():
            raise ValueError("A database name is required.")
        return self

    def engine_payload(self) -> dict:
        payload = self.model_dump(exclude={"password"})
        payload["password"] = self.password.get_secret_value()
        return payload


class Column(StrictModel):
    name: str
    type: str


class Table(StrictModel):
    name: str
    rows: int = Field(ge=0)
    columns: list[Column]


class Connection(StrictModel):
    connection_id: str = Field(min_length=1)
    name: str
    tables: list[Table]


class AnalysisRequest(StrictModel):
    connection_id: str = Field(min_length=1)
    tables: list[str] = Field(min_length=1, max_length=100)
    labels: dict[str, str] = Field(default_factory=dict)
    mode: Literal["supervised", "unsupervised"]
    target: str | None = None

    @model_validator(mode="after")
    def require_target(self):
        if self.mode == "supervised" and not (self.target and self.target.strip()):
            raise ValueError("Choose what you want to predict.")
        return self


class Insight(StrictModel):
    title: str
    description: str
    tone: Literal["positive", "info", "warning"]


class RevenuePoint(StrictModel):
    month: str
    actual: float | None
    forecast: float | None


class Category(StrictModel):
    name: str
    value: float


class Segment(Category):
    color: str


class Metrics(StrictModel):
    revenue: float | None
    customers: int | None
    orderValue: float | None


class AnalysisResult(StrictModel):
    id: str
    name: str
    rows: int = Field(ge=0)
    quality: float | None = Field(ge=0, le=100)
    accuracy: float | None = Field(ge=0, le=1)
    insights: list[Insight]
    revenue: list[RevenuePoint]
    categories: list[Category]
    segments: list[Segment]
    metrics: Metrics
    updatedAt: str


class EngineOutcome(StrictModel):
    # This must reflect a real validity assessment from the engine in both modes.
    validation_passed: bool = Field(strict=True)
    accuracy: float | None = Field(default=None, ge=0, le=1)
    result: AnalysisResult


class Progress(StrictModel):
    status: Literal["running", "retrying"] = "running"
    step: int = Field(ge=0, le=5)
    progress: float = Field(ge=0, le=100)
    message: str = Field(min_length=1, max_length=500)


class AnalysisJob(StrictModel):
    id: str
    status: Literal["queued", "running", "retrying", "completed", "failed"]
    step: int = Field(ge=0, le=5)
    progress: float = Field(ge=0, le=100)
    message: str
    accuracy: float | None = None
    result: AnalysisResult | None = None


class PredictionRequest(StrictModel):
    analysis_id: str = Field(min_length=1)
    csv: str = Field(min_length=1, max_length=5_000_000)


class PredictionResult(StrictModel):
    rows: list[dict[str, str | int | float | None]]
    summary: str
    checked_against_database: bool = Field(strict=True)
