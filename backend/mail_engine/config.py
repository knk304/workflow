"""
Mail Engine — SMTP configuration via environment variables.

All settings use the MAIL_ prefix and are read from .env or environment.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class MailSettings(BaseSettings):
    mail_enabled: bool = False
    mail_smtp_host: str = "smtp.gmail.com"
    mail_smtp_port: int = 587
    mail_smtp_user: str = ""
    mail_smtp_password: str = ""
    mail_smtp_use_tls: bool = True
    mail_from_address: str = "noreply@workflow.local"
    mail_from_name: str = "Workflow Platform"
    mail_log_enabled: bool = True
    mail_max_retries: int = 2
    mail_timeout_seconds: int = 10

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_mail_settings() -> MailSettings:
    return MailSettings()
