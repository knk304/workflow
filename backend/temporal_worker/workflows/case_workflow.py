"""
CaseWorkflow — durable orchestration layer on top of the existing Pega-Lite engine.

The workflow mirrors the Stage → Process → Step hierarchy but durably:
- Survives API restarts mid-case.
- Human steps (assignment, approval) pause execution and wait for a signal.
- Automation steps are executed directly as activities with retries.
- SLA timers are started as child SLA workflows per case.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from temporal_worker.activities.case_activities import (
        GetCaseParams,
        ResolveCaseParams,
        get_case_activity,
        resolve_case_activity,
    )
    from temporal_worker.activities.step_activities import (
        CompleteStepParams,
        complete_step_activity,
        get_active_step_activity,
    )


# ── Signal / Query payloads ──────────────────────────────────────────

@dataclass
class StepCompletedSignal:
    stage_id: str
    process_id: str
    step_id: str
    step_type: str
    completed_by: str


@dataclass
class CaseResolvedSignal:
    resolution_status: str
    resolved_by: str


@dataclass
class WorkflowStatus:
    case_id: str
    status: str
    waiting_for_step: dict | None
    completed_steps: list[str]


# ── Retry policies ───────────────────────────────────────────────────

_DEFAULT_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=5),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=5),
    maximum_attempts=10,
)

_AUTOMATION_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=10),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=10),
    maximum_attempts=20,
)


# ── Workflow ─────────────────────────────────────────────────────────

@workflow.defn
class CaseWorkflow:
    """
    Durable state machine for a single case instance.
    Waits for signals from human steps; runs automation steps directly.
    """

    def __init__(self) -> None:
        self._pending_signal: StepCompletedSignal | None = None
        self._resolved_signal: CaseResolvedSignal | None = None
        self._completed_steps: list[str] = []
        self._current_step: dict | None = None

    # ── Main run ─────────────────────────────────────────────────────

    @workflow.run
    async def run(self, case_id: str) -> str:
        """
        Poll active step → if automation: run it directly.
        If human step: wait for signal. Repeat until case is resolved.
        """
        while True:
            # Check if the case has been resolved externally
            if self._resolved_signal:
                sig = self._resolved_signal
                await workflow.execute_activity(
                    resolve_case_activity,
                    ResolveCaseParams(
                        case_id=case_id,
                        resolution_status=sig.resolution_status,
                        resolved_by=sig.resolved_by,
                    ),
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=_DEFAULT_RETRY,
                )
                return sig.resolution_status

            # Load current active step
            active = await workflow.execute_activity(
                get_active_step_activity,
                case_id,
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=_DEFAULT_RETRY,
            )

            # No active step — check if case is already done
            if active is None:
                case = await workflow.execute_activity(
                    get_case_activity,
                    GetCaseParams(case_id=case_id),
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=_DEFAULT_RETRY,
                )
                if case and case.get("status") in ("resolved", "cancelled"):
                    return case.get("resolution_status", "resolved")
                # Nothing active yet — wait briefly and re-check
                await asyncio.sleep(10)
                continue

            self._current_step = active
            step_type = active.get("step_type")

            if step_type == "automation":
                # Run automation step as a durable activity with retries
                await workflow.execute_activity(
                    complete_step_activity,
                    CompleteStepParams(
                        case_id=case_id,
                        stage_id=active["stage_id"],
                        process_id=active["process_id"],
                        step_id=active["step_id"],
                        completed_by="system",
                        config=active.get("config", {}),
                    ),
                    start_to_close_timeout=timedelta(minutes=10),
                    retry_policy=_AUTOMATION_RETRY,
                )
                step_key = f"{active['stage_id']}/{active['process_id']}/{active['step_id']}"
                self._completed_steps.append(step_key)
                self._current_step = None

            else:
                # Human step (assignment, approval, attachment, decision, subprocess)
                # Wait for the API to send a step_completed signal.
                # Timeout is an expected workflow boundary; handle it explicitly so we do not
                # let a sandbox-forbidden exception bubble into Python traceback logging.
                try:
                    await workflow.wait_condition(
                        lambda: (
                            self._pending_signal is not None
                            or self._resolved_signal is not None
                        ),
                        timeout=timedelta(minutes=5),
                    )
                except TimeoutError:
                    self._pending_signal = None
                    self._current_step = None
                    await asyncio.sleep(1)
                    continue

                if self._pending_signal:
                    sig = self._pending_signal
                    self._pending_signal = None
                    step_key = f"{sig.stage_id}/{sig.process_id}/{sig.step_id}"
                    self._completed_steps.append(step_key)
                    self._current_step = None

    # ── Signals ──────────────────────────────────────────────────────

    @workflow.signal
    async def step_completed(self, signal: StepCompletedSignal) -> None:
        """Sent by the API after a human completes an assignment or approval."""
        self._pending_signal = signal

    @workflow.signal
    async def case_resolved(self, signal: CaseResolvedSignal) -> None:
        """Sent by the API when a case is manually resolved/rejected/withdrawn."""
        self._resolved_signal = signal

    # ── Queries ──────────────────────────────────────────────────────

    @workflow.query
    def get_status(self) -> WorkflowStatus:
        return WorkflowStatus(
            case_id="",  # populated by caller from workflow ID
            status="running",
            waiting_for_step=self._current_step,
            completed_steps=list(self._completed_steps),
        )
