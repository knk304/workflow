"""
Mail Engine — Jinja2 template loader and renderer.

Templates are stored in mail_engine/templates/ as HTML files.
Renders subject lines (plain Jinja2 strings) and body HTML.
"""

import os
from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")

_env = Environment(
    loader=FileSystemLoader(_TEMPLATE_DIR),
    autoescape=select_autoescape(["html"]),
)

# Event → default template mapping
DEFAULT_TEMPLATES = {
    "case_created": "case_created.html",
    "case_status_changed": "case_status_changed.html",
    "step_assigned": "step_assigned.html",
    "step_completed": "step_completed.html",
    "case_resolved": "case_resolved.html",
}


def render_subject(subject_template: str, context: dict) -> str:
    """Render a subject line string with Jinja2 variables."""
    tpl = _env.from_string(subject_template)
    return tpl.render(**context)


def render_body(template_name: str, context: dict) -> str:
    """Render an HTML email body from a named template file."""
    tpl = _env.get_template(template_name)
    return tpl.render(**context)


def list_templates() -> list[str]:
    """Return available template filenames."""
    return [f for f in os.listdir(_TEMPLATE_DIR) if f.endswith(".html") and f != "base.html"]
