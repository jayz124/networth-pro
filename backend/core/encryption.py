"""
Encryption service for API keys and other secrets at rest.

Uses Fernet symmetric encryption (AES-128-CBC + HMAC-SHA256).
The encryption key is stored in a file outside the database directory,
auto-generated on first use.
"""
import logging
import os
import stat
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# Key file lives one level above the backend dir, outside the database
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_KEY_DIR = os.path.join(_backend_dir, ".secrets")
_KEY_FILE = os.path.join(_KEY_DIR, "encryption.key")

# Encrypted values are prefixed so we can distinguish them from plaintext
# (important for migration of existing unencrypted values)
_ENCRYPTED_PREFIX = "enc::"

_fernet: Optional[Fernet] = None


def _ensure_key_dir():
    """Create the secrets directory with restricted permissions."""
    if not os.path.exists(_KEY_DIR):
        os.makedirs(_KEY_DIR, mode=0o700)
    # Write a .gitignore to prevent accidental commit
    gitignore = os.path.join(_KEY_DIR, ".gitignore")
    if not os.path.exists(gitignore):
        with open(gitignore, "w") as f:
            f.write("*\n")


def _load_or_create_key() -> bytes:
    """Load the encryption key from file, or generate and save a new one."""
    _ensure_key_dir()

    if os.path.exists(_KEY_FILE):
        with open(_KEY_FILE, "rb") as f:
            key = f.read().strip()
        if key:
            return key

    # Generate new key
    key = Fernet.generate_key()
    with open(_KEY_FILE, "wb") as f:
        f.write(key)

    # Restrict permissions to owner only (Unix)
    try:
        os.chmod(_KEY_FILE, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass  # Windows or permission issue — best effort

    logger.info("Generated new encryption key at %s", _KEY_FILE)
    return key


def _get_fernet() -> Fernet:
    """Get or initialize the Fernet cipher."""
    global _fernet
    if _fernet is None:
        key = _load_or_create_key()
        _fernet = Fernet(key)
    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string. Returns prefixed ciphertext."""
    if not plaintext:
        return plaintext
    f = _get_fernet()
    token = f.encrypt(plaintext.encode("utf-8"))
    return _ENCRYPTED_PREFIX + token.decode("utf-8")


def decrypt(value: str) -> str:
    """Decrypt an encrypted value. Passes through unencrypted values unchanged.

    This handles the migration case where existing values are still plaintext.
    """
    if not value:
        return value
    if not value.startswith(_ENCRYPTED_PREFIX):
        # Legacy plaintext value — return as-is
        return value
    f = _get_fernet()
    token = value[len(_ENCRYPTED_PREFIX):].encode("utf-8")
    try:
        return f.decrypt(token).decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt value — key may have changed")
        return ""


def is_encrypted(value: Optional[str]) -> bool:
    """Check if a value is already encrypted."""
    return bool(value and value.startswith(_ENCRYPTED_PREFIX))


def rotate_key(new_key: Optional[bytes] = None) -> dict:
    """Re-encrypt all secrets with a new key.

    Call this from a management script or API endpoint.
    Returns stats about the rotation.

    Args:
        new_key: Optional new Fernet key bytes. If None, generates a new one.

    Returns:
        Dict with rotation stats (rotated count, errors).
    """
    global _fernet

    old_fernet = _get_fernet()

    # Generate or use provided new key
    if new_key is None:
        new_key = Fernet.generate_key()
    new_fernet = Fernet(new_key)

    # Import here to avoid circular imports
    from sqlmodel import Session, select
    from core.database import engine
    from models import AppSettings

    rotated = 0
    errors = 0

    with Session(engine) as session:
        settings = session.exec(select(AppSettings).where(AppSettings.is_secret == True)).all()

        for setting in settings:
            if not setting.value:
                continue
            try:
                # Decrypt with old key
                if setting.value.startswith(_ENCRYPTED_PREFIX):
                    token = setting.value[len(_ENCRYPTED_PREFIX):].encode("utf-8")
                    plaintext = old_fernet.decrypt(token).decode("utf-8")
                else:
                    plaintext = setting.value  # Legacy plaintext

                # Re-encrypt with new key
                new_token = new_fernet.encrypt(plaintext.encode("utf-8"))
                setting.value = _ENCRYPTED_PREFIX + new_token.decode("utf-8")
                session.add(setting)
                rotated += 1
            except Exception as e:
                logger.error("Failed to rotate key for setting '%s': %s", setting.key, e)
                errors += 1

        session.commit()

    # Save new key and update in-memory cipher
    _ensure_key_dir()
    with open(_KEY_FILE, "wb") as f:
        f.write(new_key)
    try:
        os.chmod(_KEY_FILE, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass

    _fernet = new_fernet

    logger.info("Key rotation complete: %d rotated, %d errors", rotated, errors)
    return {"rotated": rotated, "errors": errors}
