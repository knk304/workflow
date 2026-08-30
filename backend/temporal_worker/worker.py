"""
Temporal worker entry point — registers all workflows and activities, starts polling.

Run with: python -m temporal_worker.worker
"""

from __future__ import annotations

import asyncio
import logging
import sys

from temporalio.worker import Worker

from config import get_settings
from database import connect_db

from temporal_worker.client import get_temporal_client
from temporal_worker.workflows.case_workflow import CaseWorkflow
from temporal_worker.workflows.sla_workflow import SLAWorkflow
from temporal_worker.activities.case_activities import (
    get_case_activity,
    get_case_type_activity,
    advance_stage_activity,
    resolve_case_activity,
)
from temporal_worker.activities.step_activities import (
    get_step_status_activity,
    get_active_step_activity,
    complete_step_activity,
)
from temporal_worker.activities.mail_activities import (
    send_mail_activity,
    send_sla_escalation_activity,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


async def main() -> None:
    settings = get_settings()

    logger.info("Connecting to MongoDB...")
    await connect_db()

    logger.info("Connecting to Temporal at %s ...", settings.temporal_host)
    client = await get_temporal_client()

    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[CaseWorkflow, SLAWorkflow],
        activities=[
            # Case
            get_case_activity,
            get_case_type_activity,
            advance_stage_activity,
            resolve_case_activity,
            # Steps
            get_step_status_activity,
            get_active_step_activity,
            complete_step_activity,
            # Mail
            send_mail_activity,
            send_sla_escalation_activity,
        ],
    )

    logger.info(
        "Worker started — task queue: %s  namespace: %s",
        settings.temporal_task_queue,
        settings.temporal_namespace,
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
