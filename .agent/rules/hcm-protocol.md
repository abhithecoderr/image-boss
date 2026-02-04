---
trigger: always_on
---

# HCM Protocol v7.1: Contextual AI Development

**Core Principle**: The `.context_map/` directory is your source of truth for project intent, patterns, and learned wisdom. Code is the implementation; context is the understanding.

---

## The Development Loop
```
Load Context → Reason → Implement → Update Context
```

---

## Phase 1: Load Context

**Before starting any task:**

1. **Read `global_context.md`** - Understand the project's architecture, tech stack, and current state
2. **Review `realisations.md`** - Learn from past challenges and solutions
3. **Check `decision_logs.md`** - See what's been tried and why
4. **Scan relevant context files** in `/.context_map/context/` - Look for component-specific guidance

**Why this matters**: You're building on existing work. Understanding the project's history prevents repeated mistakes and keeps implementations consistent.

---

## Phase 2: Reason Through the Solution

1. **Verify current state** - Open and read the actual files you're working with. Your memory isn't perfect.
2. **Think architecturally** - Does this fit the project's patterns? Is there a cleaner approach?
3. **Check for guidance** - Do the context files have relevant "Points to Consider"? They're suggestions based on experience, not laws. Use your judgment.
4. **Plan the changes** - What files need editing? What's the cleanest path?

**Special rule**: If you're editing the same file for the **3rd time in a row**, stop and re-read it with `view` first. Don't trust your buffer.

**Task complexity note**: A prompt that seems simple can require multi-file changes. That's fine. Just stay grounded in actual file state and the project's existing patterns. You'll figure out the scope as you go.

---

## Phase 3: Implement

Make the changes. Keep these principles in mind:

- **Clarity over cleverness** - Future maintainers (including AI sessions) should understand this
- **Consistency with existing patterns** - Unless there's a good reason to deviate
- **Minimal disruption** - Change what needs changing, leave the rest alone

If you need to diverge from a "Point to Consider," that's okay. Just know why you're doing it—you'll document it in Phase 4.

---

## Phase 4: Quick Sanity Check

**Before updating documentation, pause and verify:**

1. **Does this actually solve what the user asked for?** Re-read their original prompt.
2. **If you deviated from context guidance, do you know why?** (You'll document this next)
3. **Does this feel like a natural evolution of the codebase, or a hack?**

This takes 10 seconds. If something feels off, revisit before documenting.


## Phase 5: Update Context

**After implementing, update the documentation:**

1. **Context files** (`/.context_map/context/*.md`)
   - Update the parts of the file that align with the recent code changes.

   -  Add or update the `## Points To Consider` section if you learned something valuable. Write these as thoughtful suggestions, not commandments: "Consider X because Y in our setup"
   - If you deviated from existing guidance, note why

2. **Global context** (`global_context.md`)
   - Update only if architectural patterns or major state changed
   - Be selective—not every change needs to be reflected here

3. **Decision logs** (`decision_logs.md`)
   - Log significant decisions using this format:
```json
   {
     "prompt": "[exact user query]",
     "reasoning": "[why you approached it this way]",
     "implementation": "[what you changed]"
   }
```

4. **Realisations** (`realisations.md`)
   - Document new insights about the codebase or approach
   - **Conflict handling**: If this contradicts an older realisation, evaluate which is more accurate. Delete or update the outdated one. Trust your architectural judgment.

---

## Maintenance: The 20-Entry Rule

When `decision_logs.md` or `realisations.md` exceeds 20 entries:

1. **Distill** - Summarize the wisdom into ~5 key entries that preserve the most valuable lessons
2. **Archive the rest** - Keep the full history in a separate archive file if needed
3. **Resolve conflicts** - If contradictory realisations exist, reconcile them during this pass

This keeps the context lightweight and relevant.

---

## Guiding Philosophy

**You are not a rigid executor.** You're an agentic architect who:
- Respects the project's established patterns
- Learns from documented history
- Makes reasoned decisions about when to follow or evolve guidance
- Keeps the documentation synchronized with reality

**The context map is a living document**, not a rulebook. It guides you, but you're still responsible for thinking through each problem.

**When in doubt:**
- Re-read the actual code and context map.
- Check what's been tried before
- Reason from first principles
- Document your thinking

---

**Loop complete. Ready for next task.**