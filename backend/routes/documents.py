"""Document management routes — upload, versioning, preview."""

import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from bson import ObjectId
from datetime import datetime, timezone

from auth_deps import get_current_user
from database import get_db
from id_utils import find_by_id, update_by_id
from models.phase2 import DocumentResponse, DocumentVersionResponse

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/data/documents")


def _to_response(doc: dict) -> DocumentResponse:
    return DocumentResponse(
        id=str(doc["_id"]),
        case_id=doc.get("case_id"),
        task_id=doc.get("task_id"),
        file_name=doc["file_name"],
        file_type=doc["file_type"],
        file_size=doc["file_size"],
        version=doc.get("version", 1),
        uploaded_by=doc["uploaded_by"],
        tags=doc.get("tags", []),
        storage_path=doc["storage_path"],
        current=doc.get("current", True),
        created_at=doc["created_at"],
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    case_id: str | None = Form(None),
    task_id: str | None = Form(None),
    tags: str = Form(""),
    user: dict = Depends(get_current_user),
):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    user_id = str(user["_id"])
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    # Determine version (check for existing docs with same name + case_id)
    version = 1
    query: dict = {"file_name": file.filename, "current": True}
    if case_id:
        query["case_id"] = case_id
    existing = await db.documents.find_one(query)
    if existing:
        version = existing.get("version", 1) + 1
        # Mark old version as not current
        await db.documents.update_one(
            {"_id": existing["_id"]},
            {"$set": {"current": False}},
        )

    # Save file to disk
    file_ext = os.path.splitext(file.filename or "file")[1]
    safe_name = f"{uuid.uuid4().hex}{file_ext}"
    case_folder = case_id or "unlinked"
    dir_path = os.path.join(UPLOAD_DIR, case_folder, f"v{version}")
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, safe_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    doc = {
        "case_id": case_id,
        "task_id": task_id,
        "file_name": file.filename,
        "file_type": file.content_type or "application/octet-stream",
        "file_size": len(content),
        "version": version,
        "uploaded_by": user_id,
        "tags": tag_list,
        "storage_path": file_path,
        "current": True,
        "created_at": now,
    }
    result = await db.documents.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Audit
    await db.audit_logs.insert_one({
        "entityType": "document",
        "entityId": str(result.inserted_id),
        "action": "uploaded",
        "actorId": user_id,
        "actorName": user.get("name", user.get("email", "")),
        "changes": {"after": {"file_name": file.filename, "version": version}},
        "timestamp": now,
    })

    return _to_response(doc)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    case_id: str | None = None,
    task_id: str | None = None,
    current_only: bool = True,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if case_id:
        query["case_id"] = case_id
    if task_id:
        query["task_id"] = task_id
    if current_only:
        query["current"] = True
    cursor = db.documents.find(query).sort("created_at", -1)
    return [_to_response(doc) async for doc in cursor]


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.documents, doc_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return _to_response(doc)


@router.get("/{doc_id}/download")
async def download_document(doc_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.documents, doc_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    file_path = doc["storage_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found on disk")

    return FileResponse(
        path=file_path,
        filename=doc["file_name"],
        media_type=doc.get("file_type", "application/octet-stream"),
    )


@router.get("/{doc_id}/versions", response_model=DocumentVersionResponse)
async def get_versions(doc_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.documents, doc_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    query: dict = {"file_name": doc["file_name"]}
    if doc.get("case_id"):
        query["case_id"] = doc["case_id"]

    cursor = db.documents.find(query).sort("version", -1)
    versions = [_to_response(d) async for d in cursor]
    return DocumentVersionResponse(versions=versions)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.documents, doc_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    user_id = str(user["_id"])
    if doc["uploaded_by"] != user_id and user.get("role") != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the uploader or admin can delete")

    # Soft delete by marking not current (keep file for audit trail)
    await update_by_id(db.documents, doc_id,
        {"$set": {"current": False, "deleted_at": datetime.now(timezone.utc).isoformat()}},
    )

    await db.audit_logs.insert_one({
        "entityType": "document",
        "entityId": doc_id,
        "action": "deleted",
        "actorId": user_id,
        "actorName": user.get("name", user.get("email", "")),
        "changes": {"file_name": doc["file_name"]},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
