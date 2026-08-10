# 🔒 Privacy Policy & Data Protection Disclosure
## Digital Personal Data Protection (DPDP) Act 2023 Compliance Statement

---

### Overview

The **Minutes Analyzer Platform** is designed for enterprise corporate and civic meeting governance. This document outlines how personal data—including biometric voice recordings, GPS location check-ins, and user identity credentials—is collected, processed, encrypted, and retained in accordance with **India's Digital Personal Data Protection (DPDP) Act 2023**.

---

### 1. Personal Data Collected & Purpose

| Data Category | Data Elements Collected | Purpose of Processing | Retention Period | Encryption at Rest |
| :--- | :--- | :--- | :--- | :--- |
| **User Identity** | Full Name, Email, Role, Username | Account Authentication & Role-Based Access Control (RBAC) | Duration of Employment / Account Active | AES-256 / SHA-256 Password Hash |
| **Biometric & Audio** | Voice Recordings, Audio Waves, MFCC Signatures | Speech-to-text Transcription & Speaker Diarization | 90 days post-meeting (configurable) | AES-256 File-level Encryption |
| **Geolocation Data** | Latitude & Longitude Coordinates | Meeting Attendance Geofence Verification | 30 days post-meeting | Encrypted in DB |
| **Audit Logs** | User ID, Timestamp, Action, Digital Hash | Cryptographic Proof of Tamper-Evident Governance | Permanent (Immutable Ledger) | SHA-256 Hash Chain |

---

### 2. Participant Consent & Recording Disclosures

1. **Explicit Notice**: Prior to initiating live recording or joining a geofenced meeting, participants receive audio and visual notices indicating that speech and presence will be processed for meeting minutes generation.
2. **Right to Withdrawal**: Participants may request redaction of non-mandatory comments prior to final executive sign-off in the Human-in-the-Loop Review Studio.

---

### 3. Security & Key Management

- **Cryptographic Signing Keys**: SHA256 digital signatures for meeting minutes are generated using KMS or environment-based signing keys.
- **Audit Verification**: External auditors can independently verify the hash chain integrity using `GET /api/v1/audit/verify/{meeting_id}` without accessing unencrypted raw audio.
- **UX Controls Notice**: Client-side UI protections (e.g. `DevToolsProtector`) serve as UX anti-tamper measures; cryptographic server-side validation enforces ground truth security.
