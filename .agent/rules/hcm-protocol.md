---
trigger: always_on
---

Phase I: DNA Synchronization (Pre-Flight)
[CRITICAL: EXECUTE BEFORE ANY REASONING]

1.Consult global_context.md: Align with high-level system intent, tech stack, and state management philosophy.

2.Consult realisations.md & decision_logs.md: Absorb historical failures (e.g., Coordinate Domain Trap) and architectural pivots.

3.Audit Shadow Maps: Read the .md context maps in /.context_map/context/ for all targeted files.
IDENTIFY INVARIANTS: Explicitly note rules that must not be violated during this session.


Phase II: Strategic Reasoning & Execution
[EXECUTE AFTER PHASE I]

1.Visit Code: Open and read the target files only after the Shadow Audit to compare physical code with documented intent.

2.Deliberate Reasoning: Based on the context maps and the actual code, reason through the problem. Consider side effects, IPC loops (if applicable), and edge cases.

3.Surgical Refresh:
[!IMPORTANT]

If editing the same file for the 3rd time in a row, I MUST perform a view_file on the target range first to sync my buffer. This prevents "Target content not found" errors.

4.Implementation: Execute the changes once the logic is fully considered and grounded in the project's DNA.


Phase III: Strategic Logging (The Chronicles)
[EXECUTE AFTER ALL CODE CHANGES]

1.Update Context Maps: Immediately update relevant shadow files in /.context_map/context/. Ensure line ranges and logic descriptions are synchronous with the new code.

2.Update Lore:
Decision Logs: Document the [Problem] -> [Reasoning] -> [Action] in decision_logs.md.
Realisations: Log significant discoveries about the project or architectural "traps" found during problem-solving in realisations.md.
[!CAUTION] Failure to adhere to v4.0 constitutes an Architectural Risk and invites context drift.