import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 755, "Enterprise Meeting Intelligence — 3-Chat Evolution Timeline & Upgrades Report")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(54, 747, 558, 747)

        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_text)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — COMPLETE IDE CHAT TIMELINE")
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(54, 48, 558, 48)
        self.restoreState()

def build_pdf(filename="Project_3_Chat_Evolution_Timeline_Report.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Colors
    PRIMARY = colors.HexColor("#4f46e5")    # Indigo
    SECONDARY = colors.HexColor("#0f172a")  # Slate 900
    TEXT_DARK = colors.HexColor("#1e293b")  # Slate 800
    TEXT_MUTED = colors.HexColor("#64748b") # Slate 500
    BG_LIGHT = colors.HexColor("#f8fafc")   # Slate 50
    ACCENT_PURPLE = colors.HexColor("#7c3aed")
    BORDER_COLOR = colors.HexColor("#cbd5e1")
    SUCCESS_COLOR = colors.HexColor("#059669")

    # Typography
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=SECONDARY,
        spaceAfter=3
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=PRIMARY,
        spaceAfter=12
    )
    chat_header_style = ParagraphStyle(
        'ChatHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=SECONDARY,
        spaceBefore=12,
        spaceAfter=4
    )
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=ACCENT_PURPLE,
        spaceBefore=6,
        spaceAfter=2
    )
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=TEXT_DARK,
        spaceAfter=4
    )
    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=TEXT_DARK,
        leftIndent=10,
        firstLineIndent=-6,
        spaceAfter=2
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=TEXT_DARK
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10.5,
        textColor=SECONDARY
    )
    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.white
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("Enterprise Meeting Intelligence Platform", title_style))
    story.append(Paragraph("Complete 3-Chat IDE Timeline, Feature Upgrades & Architectural Evolution", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY, spaceBefore=2, spaceAfter=8))

    # Summary Metadata Table
    summary_meta = [
        [
            Paragraph("<b>Total Development Chats:</b> 3 Sessions", table_cell),
            Paragraph("<b>Core ASR Engine:</b> Whisper ASR + Bhashini", table_cell),
            Paragraph("<b>Diarization:</b> 8-Signal / 124-Dimensional", table_cell)
        ],
        [
            Paragraph("<b>Current Production Version:</b> v3.0", table_cell),
            Paragraph("<b>Pytest Backend Tests:</b> 23/23 Passed", table_cell),
            Paragraph("<b>Security:</b> SHA-256 Ledger + GDPR Sanitized", table_cell)
        ]
    ]
    t_sum = Table(summary_meta, colWidths=[165, 175, 164])
    t_sum.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_sum)
    story.append(Spacer(1, 8))

    # ── CHAT 1 ─────────────────────────────────────────────────────────
    story.append(Paragraph("💬 CHAT 1: Ingestion Architecture, Latency Acceleration & Real-Time Streaming", chat_header_style))
    story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#cbd5e1"), spaceBefore=1, spaceAfter=4))
    
    story.append(Paragraph("<b>1.1 The Challenge & Root Cause:</b>", h2_style))
    story.append(Paragraph(
        "Audio processing was freezing and taking 3–4 minutes per upload. Investigation revealed a PyTorch Apple Silicon MPS tensor device mismatch (slow_conv2d_forward_mps).",
        body_style
    ))
    
    story.append(Paragraph("<b>1.2 Upgrades & New Features Implemented in Chat 1:</b>", h2_style))
    chat1_points = [
        "<b>ASR Processing Acceleration (4 min → 1–2 sec):</b> Switched HuggingFace Whisper ASR execution pipeline to optimized CPU (openai/whisper-tiny / openai/whisper-base), cutting latency to sub-2 seconds.",
        "<b>Real-Time 3s WebM Chunk Streaming:</b> Built /audio/recording/{id}/stream to ingest live WebM audio chunks continuously during live meetings.",
        "<b>Synchronized Live Transcript Feed (LiveTranscript.tsx):</b> Renders spoken dialogue in real-time as attendees speak, appending tokens incrementally.",
        "<b>100% Personalized Meeting Minutes Engine:</b> Overhauled _local_nlp_extract in ai_pipeline.py to extract exact sentence quotes, participant attendee names, exact financial figures ($50,000, 5 Lakhs, INR), and specific resolutions.",
        "<b>AI Grounding & Faithfulness Guardrail:</b> Implemented verify_faithfulness computing grounding_accuracy_score to ensure extracted minutes are backed by transcript tokens."
    ]
    for p in chat1_points:
        story.append(Paragraph(f"• {p}", bullet_style))

    story.append(Spacer(1, 6))

    # ── CHAT 2 ─────────────────────────────────────────────────────────
    story.append(Paragraph("💬 CHAT 2: High-Precision Multi-Signal Diarization Engine (v2.0 → v2.5)", chat_header_style))
    story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#cbd5e1"), spaceBefore=1, spaceAfter=4))
    
    story.append(Paragraph("<b>2.1 The Challenge:</b>", h2_style))
    story.append(Paragraph(
        "Standard diarization failed to accurately detect speaker changes during fast back-and-forth debates, causing speaker turns to merge erroneously.",
        body_style
    ))

    story.append(Paragraph("<b>2.2 Upgrades & New Features Implemented in Chat 2:</b>", h2_style))
    chat2_points = [
        "<b>124-Dimensional Acoustic Feature Vectors:</b> Combined 20 MFCCs + Delta + Delta-Delta + Pitch (F0) + Spectral Centroid + Zero-Crossing Rate to capture vocal resonance.",
        "<b>Sub-Second 0.8s Temporal Windows:</b> 0.8-second sliding window with 0.2-second stride (10x higher temporal resolution than standard 3s windows).",
        "<b>Cosine Metric Agglomerative Clustering:</b> Implemented adaptive distance thresholding calculated dynamically from audio feature distance statistics.",
        "<b>Interactive 1-Click Speaker Renaming:</b> Clicking speaker labels in SpeakerTimelineView.tsx opens a rename modal that updates all associated turns across the entire meeting transcript globally.",
        "<b>12 Controlled Benchmark Scenarios:</b> Created initial benchmark suite (case_01 to case_12) verifying speaker transitions, pauses, and turn preservation."
    ]
    for p in chat2_points:
        story.append(Paragraph(f"• {p}", bullet_style))

    story.append(Spacer(1, 6))

    # ── CHAT 3 ─────────────────────────────────────────────────────────
    story.append(Paragraph("💬 CHAT 3: Production-Grade Speaker Voice Enrollment & Identity-Aware Diarization (v3.0)", chat_header_style))
    story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#cbd5e1"), spaceBefore=1, spaceAfter=4))
    
    story.append(Paragraph("<b>3.1 The Innovation & Core Concept:</b>", h2_style))
    story.append(Paragraph(
        "Introduced pre-meeting participant voice calibration so the AI learns each person's unique acoustic signature at the start of the meeting and recognizes them accurately during subsequent speaking turns.",
        body_style
    ))

    story.append(Paragraph("<b>3.2 Upgrades & Major New Features Implemented in Chat 3:</b>", h2_style))
    chat3_points = [
        "<b>3-Sample Multi-Criteria Voice Calibration (SpeakerCalibrationView.tsx):</b> Collects 3 distinct 5–10s audio samples per participant under natural speaking conditions.",
        "<b>Interactive Quality Scorecard:</b> Automated gate checks for SNR (>8 dB), Audio Clipping (<4%), VAD Speech Ratio (>35%), and feature stability with 'Good to Enroll' or 'Please Record Again' guidance.",
        "<b>Anti-Spoofing Dynamic Phrases:</b> Generates randomized dynamic phrases ('The quick brown fox jumps over 42 lazy dogs in Q3') to prevent audio replay attacks.",
        "<b>8th Signal Integration:</b> Embedded Calibrated Identity Match Evidence into the MultiSignalDiarizationEngine alongside the 7 acoustic/VAD signals.",
        "<b>4-Tier Identity Decision Matrix:</b> MATCHED (>=0.72), AMBIGUOUS (0.55-0.72), UNKNOWN (<0.55 - never forces false match), and UNAVAILABLE (declined consent).",
        "<b>Biometric Privacy & 1-Click Vector Purging:</b> Explicit consent toggle, sanitized public DTOs (CalibratedVoiceProfilePublic), and DELETE /api/v1/meetings/{id}/voice-profiles/{id}.",
        "<b>Profile Drift Guardrail (>0.35 distance):</b> Flags acoustic drift as ProfileDriftCandidate for host review rather than silently overwriting enrolled profiles.",
        "<b>Human Correction Learning:</b> When a reviewer corrects an UNKNOWN_SPEAKER tag, the system creates a candidate profile update.",
        "<b>'Why This Speaker?' Explanation Modal:</b> Interactive modal displaying exact evidence (Cosine 94%, Pitch F0 91%, Spectral Centroid 95%, Profile Stability 97%).",
        "<b>Enterprise Voice Profiles Dashboard (/voice-profiles):</b> Dedicated page managing active profiles, quality scores, versions (v1-v3), and drift risk levels.",
        "<b>Comprehensive Verification:</b> 22 benchmark scenarios (case_01 to case_22), 23/23 Pytest backend suites passing, and clean Next.js build."
    ]
    for p in chat3_points:
        story.append(Paragraph(f"• {p}", bullet_style))

    story.append(Spacer(1, 8))

    # ── SUMMARY TABLE ACROSS 3 CHATS ───────────────────────────────────
    story.append(Paragraph("📊 Summary Matrix Across the 3 Project Chats", chat_header_style))
    
    chat_matrix_data = [
        [Paragraph("Milestone Domain", table_header), Paragraph("Chat 1 Focus", table_header), Paragraph("Chat 2 Focus", table_header), Paragraph("Chat 3 Focus (Current v3.0)", table_header)],
        [
            Paragraph("<b>ASR / Audio</b>", table_cell_bold),
            Paragraph("CPU Whisper fix; 1-2s latency", table_cell),
            Paragraph("Sub-second 0.8s chunk alignment", table_cell),
            Paragraph("Dynamic phrase anti-spoofing + SNR gate", table_cell)
        ],
        [
            Paragraph("<b>Live Streaming</b>", table_cell_bold),
            Paragraph("3s WebM chunk streaming", table_cell),
            Paragraph("Live transcript word alignment", table_cell),
            Paragraph("Pre-flight calibration roster check", table_cell)
        ],
        [
            Paragraph("<b>Diarization</b>", table_cell_bold),
            Paragraph("Basic turn splitting", table_cell),
            Paragraph("124-dim spectral vectors", table_cell),
            Paragraph("8-signal matrix + 4-tier classification", table_cell)
        ],
        [
            Paragraph("<b>Voice Profiles</b>", table_cell_bold),
            Paragraph("None", table_cell),
            Paragraph("Single-turn centroid memory", table_cell),
            Paragraph("3-sample composite profiles + drift guard", table_cell)
        ],
        [
            Paragraph("<b>Minutes / NLP</b>", table_cell_bold),
            Paragraph("Personalized sentence quotes", table_cell),
            Paragraph("Faithfulness grounding score", table_cell),
            Paragraph("Decision register + Action items", table_cell)
        ],
        [
            Paragraph("<b>UI / Studio</b>", table_cell_bold),
            Paragraph("Live transcript view", table_cell),
            Paragraph("1-click speaker renaming", table_cell),
            Paragraph("/voice-profiles + 'Why This Speaker?'", table_cell)
        ],
        [
            Paragraph("<b>Governance</b>", table_cell_bold),
            Paragraph("Basic SQLite records", table_cell),
            Paragraph("SHA-256 Audit chain logging", table_cell),
            Paragraph("Biometric purging + GDPR sanitization", table_cell)
        ]
    ]

    t_matrix = Table(chat_matrix_data, colWidths=[100, 130, 130, 144])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT])
    ]))
    story.append(t_matrix)

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated 3-Chat PDF: {filename}")

if __name__ == "__main__":
    build_pdf()
