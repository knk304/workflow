"""
Migration: rename node type 'question' -> 'form' in MongoDB.

Affects:
  - flow_definitions  : definition.nodes[].type
  - flow_executions   : (currentNodeId resolved at runtime, no stored type — no action needed)

Run from backend/ directory:
    python migrate_question_to_form.py
"""
import asyncio
import sys

sys.path.insert(0, ".")


async def run() -> None:
    from database import connect_db, get_db

    await connect_db()
    db = get_db()

    # ── flow_definitions ─────────────────────────────────────────────
    # Update every node whose type == "question" inside definition.nodes array
    result = await db.flow_definitions.update_many(
        {"definition.nodes.type": "question"},
        {"$set": {"definition.nodes.$[elem].type": "form"}},
        array_filters=[{"elem.type": "question"}],
    )
    print(f"flow_definitions: matched={result.matched_count}  modified={result.modified_count}")

    # Verify
    remaining = await db.flow_definitions.count_documents({"definition.nodes.type": "question"})
    if remaining == 0:
        print("✓ No remaining 'question' node types in flow_definitions.")
    else:
        print(f"⚠ {remaining} document(s) still contain 'question' node type — check nested structures.")

    # ── flow_executions ───────────────────────────────────────────────
    # flow_executions stores answers (nodeId, fieldId, value) and visitedNodes (list of IDs).
    # Node type is NOT stored in executions, so no update needed there.
    print("flow_executions: no node-type fields stored — skipped.")


if __name__ == "__main__":
    asyncio.run(run())
