"""
Step handler package — one module per step type.

Each handler exposes:
  async def activate(case, stage_id, process_id, step, case_type_def, db) -> dict
      Called when the engine reaches this step.
  async def complete(case, stage_id, process_id, step, data, user, db) -> dict
      Called when a user completes the step (human steps only).
"""
