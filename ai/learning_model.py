"""
ai/learning_model.py
---------------------
Learning system that improves post generation quality over time by recording
Alberto's approval/rejection/edit decisions and computing confidence scores.

Storage:
  - Local JSON file: data/learning_data.json  (read/written on every call)
  - Cloudflare D1 (via Workers API): posts decisions for remote persistence
    and potential cross-device sync.

Main class: LearningModel
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from collections import defaultdict

import httpx

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [LEARNING] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("learning_model")

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

DecisionType = Literal["approved", "rejected", "edited"]

# ---------------------------------------------------------------------------
# Path configuration
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DATA_DIR = _REPO_ROOT / "data"
_DATA_DIR.mkdir(parents=True, exist_ok=True)
_LOCAL_JSON = _DATA_DIR / "learning_data.json"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AUTOPUBLISH_MIN_CONFIDENCE = 0.90    # Confidence threshold for autopublish
AUTOPUBLISH_MIN_DECISIONS = 50       # Minimum decisions before autopublish is considered
CONFIDENCE_THRESHOLD_TARGET = 0.85   # Target confidence for "estimated weeks" calc
WEEKLY_DECISIONS_ESTIMATE = 14       # Estimated decisions per week (2 per day)


class LearningModel:
    """
    Records user decisions on generated posts and computes approval confidence.

    Decision data schema (per record in self._data['decisions']):
    {
        "post_id":               str,
        "decision":              "approved" | "rejected" | "edited",
        "edit_ratio":            float,  # 0.0 (no edit) – 1.0 (rewritten)
        "time_to_decide_seconds": int,
        "timestamp":             str,    # ISO 8601
        "sector":                str,
        "source_type":           str,    # 'normativa' | 'actualidad'
        "source_name":           str,    # RSS feed name or 'boe'
        "char_count":            int,
        "ai_score":              int,
        "ai_urgency":            str,
    }
    """

    def __init__(self) -> None:
        self._data = self._load()

    # -----------------------------------------------------------------------
    # Persistence helpers
    # -----------------------------------------------------------------------

    def _load(self) -> dict:
        """Loads decision data from local JSON file. Creates file if absent."""
        if _LOCAL_JSON.exists():
            try:
                with _LOCAL_JSON.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    log.info(
                        "Loaded %d decisions from %s",
                        len(data.get("decisions", [])),
                        _LOCAL_JSON,
                    )
                    return data
            except (json.JSONDecodeError, OSError) as exc:
                log.error("Could not load %s: %s. Starting fresh.", _LOCAL_JSON, exc)

        return {"decisions": [], "metadata": {"created_at": datetime.now(timezone.utc).isoformat()}}

    def _save(self) -> None:
        """Persists decision data to local JSON file."""
        try:
            with _LOCAL_JSON.open("w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
        except OSError as exc:
            log.error("Could not save %s: %s", _LOCAL_JSON, exc)

    def _sync_to_cloudflare(self, record: dict) -> None:
        """
        POSTs a single decision record to Cloudflare Workers API (D1 backend).
        Reads endpoint and auth token from environment variables:
            CF_WORKER_URL   – e.g. https://linkedin-bot.your-account.workers.dev
            CF_WORKER_TOKEN – Bearer token for the worker endpoint

        Silently logs errors; never raises (non-blocking).
        """
        worker_url = os.environ.get("CF_WORKER_URL", "")
        worker_token = os.environ.get("CF_WORKER_TOKEN", "")

        if not worker_url:
            log.debug("CF_WORKER_URL not set; skipping Cloudflare sync.")
            return

        try:
            headers = {"Content-Type": "application/json"}
            if worker_token:
                headers["Authorization"] = f"Bearer {worker_token}"

            with httpx.Client(timeout=10) as client:
                resp = client.post(
                    f"{worker_url.rstrip('/')}/api/decisions",
                    json=record,
                    headers=headers,
                )
                if resp.status_code in (200, 201):
                    log.info("Decision synced to Cloudflare D1 (post_id=%s).", record["post_id"])
                else:
                    log.warning(
                        "Cloudflare sync returned HTTP %d for post_id=%s.",
                        resp.status_code, record["post_id"],
                    )
        except Exception as exc:
            log.warning("Cloudflare sync error for post_id=%s: %s", record["post_id"], exc)

    # -----------------------------------------------------------------------
    # Core public methods
    # -----------------------------------------------------------------------

    def record_decision(
        self,
        post_id: str,
        decision: DecisionType,
        edit_ratio: float,
        time_to_decide_seconds: int,
        post_metadata: dict,
    ) -> None:
        """
        Records Alberto's decision on a generated post.

        Args:
            post_id:                  Unique identifier of the generated post.
            decision:                 'approved', 'rejected', or 'edited'.
            edit_ratio:               Fraction of the post that was changed
                                      (0.0 = no changes, 1.0 = fully rewritten).
            time_to_decide_seconds:   Seconds from post presentation to decision.
            post_metadata:            Dict from content_generator output, expected
                                      to contain: sector, type, source_name,
                                      char_count, ai_score, ai_urgency.
        """
        record = {
            "post_id": post_id,
            "decision": decision,
            "edit_ratio": round(float(edit_ratio), 3),
            "time_to_decide_seconds": int(time_to_decide_seconds),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sector": post_metadata.get("sector", "general"),
            "source_type": post_metadata.get("type", "unknown"),
            "source_name": post_metadata.get("source_name", "boe"),
            "char_count": post_metadata.get("char_count", 0),
            "ai_score": post_metadata.get("ai_score", 0),
            "ai_urgency": post_metadata.get("ai_urgency", "baja"),
        }

        self._data["decisions"].append(record)
        self._save()
        log.info(
            "Decision recorded: post_id=%s decision=%s edit_ratio=%.2f",
            post_id, decision, edit_ratio,
        )

        # Async sync to Cloudflare (fire-and-forget, non-blocking)
        self._sync_to_cloudflare(record)

    def calculate_confidence(self, post_metadata: dict) -> float:
        """
        Returns a 0.0–1.0 confidence score estimating the probability that
        this type of post will be approved by Alberto.

        Combines four weighted signals:
            1. Sector approval rate          (weight 0.40)
            2. Source-type approval rate     (weight 0.25)
            3. Character-length preference   (weight 0.20)
            4. Average edit ratio (inverted) (weight 0.15)

        With fewer than 5 decisions total, returns 0.0 (insufficient data).

        Args:
            post_metadata: Dict with at least 'sector', 'type', 'char_count'.

        Returns:
            Confidence float in [0.0, 1.0].
        """
        decisions = self._data.get("decisions", [])
        if len(decisions) < 5:
            log.debug("Insufficient data for confidence (%d decisions).", len(decisions))
            return 0.0

        sector = post_metadata.get("sector", "general")
        source_type = post_metadata.get("type", "normativa")
        char_count = post_metadata.get("char_count", 900)

        # Signal 1: sector approval rate
        sector_decisions = [d for d in decisions if d["sector"] == sector]
        sector_rate = (
            sum(1 for d in sector_decisions if d["decision"] == "approved")
            / len(sector_decisions)
            if sector_decisions else 0.5  # neutral prior
        )

        # Signal 2: source-type approval rate
        type_decisions = [d for d in decisions if d["source_type"] == source_type]
        type_rate = (
            sum(1 for d in type_decisions if d["decision"] == "approved")
            / len(type_decisions)
            if type_decisions else 0.5
        )

        # Signal 3: length preference
        # Find the average char_count of approved posts; penalise deviation
        approved = [d for d in decisions if d["decision"] == "approved"]
        if approved:
            avg_len = sum(d["char_count"] for d in approved) / len(approved)
            # Normalised distance: 0.0 if identical, capped at 1.0
            length_penalty = min(abs(char_count - avg_len) / 600, 1.0)
            length_score = 1.0 - length_penalty
        else:
            length_score = 0.5

        # Signal 4: average edit ratio (lower edit ratio → higher confidence)
        edited_decisions = [d for d in decisions if d["decision"] in ("approved", "edited")]
        if edited_decisions:
            avg_edit = sum(d["edit_ratio"] for d in edited_decisions) / len(edited_decisions)
            edit_score = 1.0 - avg_edit
        else:
            edit_score = 0.5

        confidence = (
            sector_rate  * 0.40
            + type_rate  * 0.25
            + length_score * 0.20
            + edit_score * 0.15
        )

        confidence = max(0.0, min(1.0, confidence))
        log.debug(
            "Confidence for sector=%s type=%s → %.3f "
            "(sector=%.2f type=%.2f len=%.2f edit=%.2f)",
            sector, source_type, confidence,
            sector_rate, type_rate, length_score, edit_score,
        )
        return round(confidence, 3)

    def get_sector_stats(self) -> dict:
        """
        Returns approval rate and decision counts broken down by sector.

        Returns:
            Dict keyed by sector, each value a dict:
                {approved, rejected, edited, total, approval_rate}
        """
        decisions = self._data.get("decisions", [])
        stats: dict[str, dict] = defaultdict(
            lambda: {"approved": 0, "rejected": 0, "edited": 0, "total": 0}
        )

        for d in decisions:
            sector = d.get("sector", "general")
            decision = d.get("decision", "rejected")
            stats[sector]["total"] += 1
            stats[sector][decision] = stats[sector].get(decision, 0) + 1

        # Compute approval rate for each sector
        result = {}
        for sector, counts in stats.items():
            total = counts["total"]
            result[sector] = {
                **counts,
                "approval_rate": round(
                    counts.get("approved", 0) / total, 3
                ) if total > 0 else 0.0,
            }

        return result

    def get_improvement_summary(self) -> dict:
        """
        Returns a high-level summary of the learning model's progress.

        Returns:
            Dict with keys:
                total_decisions       – int
                approval_rate         – float (0.0–1.0)
                avg_confidence_trend  – list[float], approval rate over time
                                        in 10-decision windows
                estimated_weeks_to_autopublish – int | None
        """
        decisions = self._data.get("decisions", [])
        total = len(decisions)

        if total == 0:
            return {
                "total_decisions": 0,
                "approval_rate": 0.0,
                "avg_confidence_trend": [],
                "estimated_weeks_to_autopublish": None,
            }

        # Overall approval rate
        approved_count = sum(1 for d in decisions if d["decision"] == "approved")
        approval_rate = round(approved_count / total, 3)

        # Approval rate trend: rolling 10-decision windows
        window_size = 10
        trend: list[float] = []
        for i in range(0, total, window_size):
            window = decisions[i: i + window_size]
            rate = sum(1 for d in window if d["decision"] == "approved") / len(window)
            trend.append(round(rate, 3))

        # Estimate weeks until autopublish threshold is reached
        current_rate = trend[-1] if trend else 0.0
        weeks_estimate: int | None = None
        if current_rate < CONFIDENCE_THRESHOLD_TARGET:
            gap = CONFIDENCE_THRESHOLD_TARGET - current_rate
            # Assume linear improvement: each 10-decision window improves by ~0.05
            decisions_needed = (gap / 0.05) * window_size
            weeks_estimate = max(1, int(decisions_needed / WEEKLY_DECISIONS_ESTIMATE))
        else:
            weeks_estimate = 0  # Already above threshold

        return {
            "total_decisions": total,
            "approval_rate": approval_rate,
            "avg_confidence_trend": trend,
            "estimated_weeks_to_autopublish": weeks_estimate,
        }

    def should_autopublish(self, post_metadata: dict) -> bool:
        """
        Returns True only if:
            1. Total recorded decisions ≥ AUTOPUBLISH_MIN_DECISIONS (50), AND
            2. Confidence for this post type > AUTOPUBLISH_MIN_CONFIDENCE (0.90).

        This prevents autopublish from triggering on insufficient data.

        Args:
            post_metadata: Dict with sector, type, char_count.

        Returns:
            bool
        """
        decisions = self._data.get("decisions", [])
        if len(decisions) < AUTOPUBLISH_MIN_DECISIONS:
            log.debug(
                "Autopublish skipped: only %d/%d decisions recorded.",
                len(decisions), AUTOPUBLISH_MIN_DECISIONS,
            )
            return False

        confidence = self.calculate_confidence(post_metadata)
        should = confidence > AUTOPUBLISH_MIN_CONFIDENCE

        log.info(
            "Autopublish check: confidence=%.3f threshold=%.2f → %s",
            confidence, AUTOPUBLISH_MIN_CONFIDENCE,
            "YES" if should else "NO",
        )
        return should
