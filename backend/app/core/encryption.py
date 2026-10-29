import os
import hashlib
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

class AES256EncryptionService:
    """
    AES-256-GCM Encryption Service at Rest (Section 6.18, Gap 2, PRIVACY.md).
    Provides authenticated 256-bit AES encryption for stored audio artifacts,
    biometric voice profile embeddings, and sensitive meeting data.
    """
    def __init__(self, key: Optional[bytes] = None):
        if key is None:
            secret = getattr(settings, "SECRET_KEY", "enterprise_aes256_master_key_meeting_system")
            self.key = hashlib.sha256(secret.encode("utf-8")).digest()
        else:
            self.key = key
        self.aesgcm = AESGCM(self.key)

    def encrypt_bytes(self, plaintext: bytes, associated_data: Optional[bytes] = None) -> bytes:
        """Encrypts raw bytes using AES-256-GCM with a fresh 96-bit (12-byte) nonce."""
        nonce = os.urandom(12)
        ciphertext = self.aesgcm.encrypt(nonce, plaintext, associated_data)
        return nonce + ciphertext

    def decrypt_bytes(self, encrypted_data: bytes, associated_data: Optional[bytes] = None) -> bytes:
        """Decrypts AES-256-GCM data using prefix 12-byte nonce."""
        if len(encrypted_data) < 28:
            raise ValueError("Invalid encrypted data length for AES-256-GCM")
        nonce = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        return self.aesgcm.decrypt(nonce, ciphertext, associated_data)

    def encrypt_file(self, file_path: str, output_path: Optional[str] = None) -> str:
        """Encrypts a file in place or to a designated .enc path."""
        target = output_path or file_path + ".enc"
        with open(file_path, "rb") as f:
            data = f.read()
        encrypted = self.encrypt_bytes(data)
        with open(target, "wb") as f:
            f.write(encrypted)
        return target

    def decrypt_file(self, encrypted_path: str, output_path: Optional[str] = None) -> bytes:
        """Decrypts an AES-256 encrypted file."""
        with open(encrypted_path, "rb") as f:
            encrypted_data = f.read()
        decrypted = self.decrypt_bytes(encrypted_data)
        if output_path:
            with open(output_path, "wb") as f:
                f.write(decrypted)
        return decrypted

encryption_service = AES256EncryptionService()
