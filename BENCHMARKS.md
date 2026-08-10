# 📊 Minutes Analyzer Platform — Official Benchmarks Scorecard

This document contains automated evaluation benchmark metrics for speaker diarization, AI minutes summarization quality, and extraction faithfulness across platform release versions.

---

## 📈 Benchmark Scorecard Metrics

| Release Milestone | Diarization Error Rate (DER) | ROUGE-1 | ROUGE-2 | ROUGE-L | Faithfulness Precision | Faithfulness Recall |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 0 Baseline** | `1.67%` | `0.2326` | `0.0488` | `0.1860` | `50.0%` | `100.0%` |
| **Phase 1 (PyAnnote Diarization)** | `1.67%` | `0.2326` | `0.0488` | `0.1860` | `50.0%` | `100.0%` |
| **Phase 2 (Faithfulness Guardrails)** | `1.67%` | `0.2326` | `0.0488` | `0.1860` | `50.0%` | `100.0%` |

---

## 🛠️ How to Re-Run Benchmark Scoring

Execute the automated scoring suite from the workspace root:

```bash
./venv/bin/python benchmarks/evaluate.py
```
