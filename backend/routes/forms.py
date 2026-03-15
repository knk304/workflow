"""Form builder — dynamic case form definitions and submissions."""

from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from auth_deps import get_current_user
from database import get_db
from id_utils import find_by_id, update_by_id

router = APIRouter(prefix="/api/forms", tags=["forms"])


# ---------- Models ----------

class FieldValidation(BaseModel):
    model_config = {"populate_by_name": True}
    required: bool = False
    min_length: int | None = Field(default=None, alias="minLength")
    max_length: int | None = Field(default=None, alias="maxLength")
    pattern: str | None = None
    min_value: float | None = Field(default=None, alias="minValue")
    max_value: float | None = Field(default=None, alias="maxValue")
    options: list[str] | None = None


class FormField(BaseModel):
    model_config = {"populate_by_name": True}
    id: str
    type: str  # text, textarea, number, date, select, checkbox, radio, file
    label: str
    placeholder: str = ""
    default_value: str | None = Field(default=None, alias="defaultValue")
    validation: FieldValidation = FieldValidation()
    order: int = 0
    section: str = "default"
    visible_when: dict | None = Field(default=None, alias="visibleWhen")  # conditional visibility


class FormSection(BaseModel):
    id: str
    title: str
    order: int = 0


class FormDefinitionCreate(BaseModel):
    model_config = {"populate_by_name": True}
    name: str
    case_type_id: str | None = Field(default=None, alias="caseTypeId")
    stage: str | None = None
    sections: list[FormSection] = []
    fields: list[FormField]
    description: str = ""


class FormSubmission(BaseModel):
    model_config = {"populate_by_name": True}
    form_id: str = Field(alias="formId")
    case_id: str = Field(alias="caseId")
    data: dict


# ---------- Helpers ----------

def _form_response(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "caseTypeId": doc.get("case_type_id"),
        "stage": doc.get("stage"),
        "sections": doc.get("sections", []),
        "fields": doc["fields"],
        "description": doc.get("description", ""),
        "version": doc.get("version", 1),
        "isActive": doc.get("is_active", True),
        "createdAt": doc["created_at"],
        "updatedAt": doc.get("updated_at"),
    }


def _submission_response(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "formId": doc["form_id"],
        "caseId": doc["case_id"],
        "data": doc["data"],
        "submittedBy": doc["submitted_by"],
        "submittedAt": doc["submitted_at"],
    }


# ---------- Form Definition CRUD ----------

@router.post("/definitions", status_code=status.HTTP_201_CREATED)
async def create_form_definition(body: FormDefinitionCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": body.name,
        "case_type_id": body.case_type_id,
        "stage": body.stage,
        "sections": [s.model_dump(by_alias=True) for s in body.sections],
        "fields": [f.model_dump(by_alias=True) for f in body.fields],
        "description": body.description,
        "version": 1,
        "is_active": True,
        "created_by": str(user["_id"]),
        "created_at": now,
    }
    result = await db.case_forms.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _form_response(doc)


@router.get("/definitions")
async def list_form_definitions(
    case_type_id: str | None = None,
    stage: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"is_active": True}
    if case_type_id:
        query["case_type_id"] = case_type_id
    if stage:
        query["stage"] = stage
    cursor = db.case_forms.find(query)
    return [_form_response(doc) async for doc in cursor]


@router.get("/definitions/{form_id}")
async def get_form_definition(form_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.case_forms, form_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")
    return _form_response(doc)


@router.patch("/definitions/{form_id}")
async def update_form_definition(form_id: str, body: FormDefinitionCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.case_forms, form_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")

    now = datetime.now(timezone.utc).isoformat()
    update = {
        "name": body.name,
        "case_type_id": body.case_type_id,
        "stage": body.stage,
        "sections": [s.model_dump(by_alias=True) for s in body.sections],
        "fields": [f.model_dump(by_alias=True) for f in body.fields],
        "description": body.description,
        "version": doc.get("version", 1) + 1,
        "updated_at": now,
    }
    await update_by_id(db.case_forms, form_id, {"$set": update})
    doc.update(update)
    return _form_response(doc)


@router.delete("/definitions/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_form_definition(form_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    result = await update_by_id(db.case_forms, form_id,
        {"$set": {"is_active": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form not found")


# ---------- Form Submissions ----------

@router.post("/submissions", status_code=status.HTTP_201_CREATED)
async def submit_form(body: FormSubmission, user: dict = Depends(get_current_user)):
    db = get_db()
    # Validate form exists
    form_doc = await find_by_id(db.case_forms, body.form_id)
    if not form_doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Form definition not found")

    # Validate required fields
    errors = []
    for field in form_doc["fields"]:
        validation = field.get("validation", {})
        if validation.get("required") and not body.data.get(field["id"]):
            errors.append(f"Field '{field['label']}' is required")
    if errors:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=errors)

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "form_id": body.form_id,
        "case_id": body.case_id,
        "data": body.data,
        "submitted_by": str(user["_id"]),
        "submitted_at": now,
    }
    result = await db.form_submissions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _submission_response(doc)


@router.get("/submissions")
async def list_submissions(
    case_id: str | None = None,
    form_id: str | None = None,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {}
    if case_id:
        query["case_id"] = case_id
    if form_id:
        query["form_id"] = form_id
    cursor = db.form_submissions.find(query)
    return [_submission_response(doc) async for doc in cursor]


@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await find_by_id(db.form_submissions, submission_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    return _submission_response(doc)
