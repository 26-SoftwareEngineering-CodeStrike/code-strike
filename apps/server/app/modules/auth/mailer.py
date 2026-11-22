import smtplib
import ssl
from email.message import EmailMessage
from typing import Protocol

from app.core.config import get_settings
from app.core.exceptions import DomainError


class Mailer(Protocol):
    def send_code(self, email: str, code: str, purpose: str) -> None: ...


class SMTPMailer:
    def send_code(self, email: str, code: str, purpose: str) -> None:
        settings = get_settings()
        if not settings.smtp_host or not settings.smtp_from:
            raise DomainError('EMAIL_UNAVAILABLE', 'SMTP delivery is not configured.', 503)
        message = EmailMessage()
        message['From'] = settings.smtp_from
        message['To'] = email
        message['Subject'] = 'CodeStrike verification code'
        message.set_content(f'Your {purpose} verification code is {code}.\n'
                            f'It expires in {settings.email_code_ttl_seconds} seconds.')
        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                if settings.smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password or '')
                smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as exc:
            raise DomainError('EMAIL_UNAVAILABLE', 'Email delivery failed; retry later.', 503) from exc


def get_mailer() -> Mailer:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from:
        raise DomainError('EMAIL_UNAVAILABLE', 'SMTP delivery is not configured.', 503)
    return SMTPMailer()
