"""Utility: safe MongoDB _id lookup that handles both ObjectId and string _id values."""

from bson import ObjectId
from bson.errors import InvalidId


def to_query_id(id_str: str):
    """Return a query dict that matches _id as ObjectId or raw string."""
    try:
        oid = ObjectId(id_str)
        return {"$or": [{"_id": oid}, {"_id": id_str}]}
    except (InvalidId, TypeError):
        return {"_id": id_str}


async def find_by_id(collection, id_str: str):
    """Find a document by _id, trying ObjectId first then raw string."""
    try:
        doc = await collection.find_one({"_id": ObjectId(id_str)})
        if doc:
            return doc
    except (InvalidId, TypeError):
        pass
    return await collection.find_one({"_id": id_str})


async def update_by_id(collection, id_str: str, update: dict):
    """Update a document by _id, trying ObjectId first then raw string."""
    try:
        result = await collection.update_one({"_id": ObjectId(id_str)}, update)
        if result.matched_count > 0:
            return result
    except (InvalidId, TypeError):
        pass
    return await collection.update_one({"_id": id_str}, update)


async def delete_by_id(collection, id_str: str):
    """Delete a document by _id, trying ObjectId first then raw string."""
    try:
        result = await collection.delete_one({"_id": ObjectId(id_str)})
        if result.deleted_count > 0:
            return result
    except (InvalidId, TypeError):
        pass
    return await collection.delete_one({"_id": id_str})
