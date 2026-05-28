# Sovereign Validation Plan: Image Generation Grid

## Objective
To verify the operational integrity of the sovereign image generation pipeline, ensuring zero-latency failover, multi-regional resilience, and unified service observability.

---

## 1. Parallel Probing Verification
**Goal**: Confirm that `NanoBananaService` successfully fires multiple regional probes simultaneously.### Test Steps
1.  Open the **PromptTool** (Port 3001).
2.  Initiate a single image generation.
3.  Execute the following command to monitor real-time logs:
    ```bash
    ./prompttool-ctl.sh status | grep "Parallel Probe Start"
    ```### Success Criteria
- [x] [AI] Landmark: Parallel Regional Probing 5 distinct regions (e.g., `us-central1`, `us-east1`, `europe-west1`, etc.) starting probes within the same second.

---

## 2. Multi-Regional Failover Resilience
**Goal**: Verify the `ReliabilityTracker` correctly blacklists failing regions and pivots the global hunt.### Test Steps
1.  Induce a "synthetic failure" in `us-central1` (e.g., by temporarily removing permissions or using a non-existent model name in the config).
2.  Trigger a generation.
3.  Check the `nanobanana_stats.json` persistence file:
    ```bash
    cat /home/heidless/projects/PromptTool/.config/persona/nanobanana_stats.json
    ```### Test Steps
1.  Check the Status Badge in the PromptTool header.
2.  Simulate a quota approval by manually overriding the API response (temporary dev test):
    ```bash
    # Mocking a sovereign state
    curl -X GET http://localhost:3006/api/quota/status -H "Authorization: Bearer <TOKEN>"
    ```### Test Steps
1.  Run the master status check:
    ```bash
    for s in *-ctl.sh; do $s status; done
    ```### Test Steps
1.  Generate a batch of 4 images at "High Quality" (Imagen 3.0).
2.  Verify the prompt is correctly saved to the **Stillwater Registry**.
3.  Verify the image is visible in the **Gallery** with full metadata.
