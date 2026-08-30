"""
SLAWorkflow — replaces the 15-minute polling loop in main.py with precise durable timers.

One SLAWorkflow is started per case when the case is created (if use_temporal is set).
It sleeps until the SLA target date, then fires an escalation activity.
The workflow can be cancelled via signal when a case resolves before the deadline.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from temporal_worker.activities.mail_activities import send_sla_escalation_activity


@dataclass
class SLAWorkflowParams:
    case_id: str
    sla_target_date: str  # ISO-8601 UTC string
    escalation_intervals_hours: list[int] = None  # e.g. [0, 24, 48] hours after breach

    def __post_init__(self):
        if self.escalation_intervals_hours is None:
            self.escalation_intervals_hours = [0, 24, 48]


_ESCALATION_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=10),
    maximum_interval=timedelta(minutes=5),
    maximum_attempts=5,
)


@workflow.defn
class SLAWorkflow:
    """
    Sleeps until SLA deadline, escalates, then escalates again at configured intervals.
    Cancelled via signal when the case is resolved before breach.
    """

    def __init__(self) -> None:
        self._cancelled = False

    @workflow.run
    async def run(self, params: SLAWorkflowParams) -> str:
        deadline = datetime.fromisoformat(params.sla_target_date)
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        now = workflow.now()
        wait_seconds = (deadline - now).total_seconds()

        if wait_seconds > 0:
            # Durable sleep — survives restarts
            await workflow.wait_condition(
                lambda: self._cancelled,
                timeout=timedelta(seconds=wait_seconds),
            )

        if self._cancelled:
            return "cancelled"

        # Fire escalations at each configured interval after the breach
        for extra_hours in (params.escalation_intervals_hours or [0]):
            if self._cancelled:
                break

            if extra_hours > 0:
                await workflow.wait_condition(
                    lambda: self._cancelled,
                    timeout=timedelta(hours=extra_hours),
                )
                if self._cancelled:
                    break

            await workflow.execute_activity(
                send_sla_escalation_activity,
                params.case_id,
                start_to_close_timeout=timedelta(seconds=60),
                retry_policy=_ESCALATION_RETRY,
            )

        return "escalated"

    @workflow.signal
    async def cancel_sla(self) -> None:
        """Sent when the case resolves before the SLA deadline."""
        self._cancelled = True
