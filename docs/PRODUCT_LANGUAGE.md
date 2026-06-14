# Product Language

This is the canonical vocabulary for Vanguard UI, docs, and agent-facing work. Code may keep legacy component/table names when renaming would create churn, but user-facing copy and new docs should use these terms.

| Canonical term | Polish UI label | Meaning | Replaces / avoid |
|---|---|---|---|
| Plan | Plan | A bounded commitment for a day or week. Plans contain selected tasks/moves, not every possible intention. | Power List as a product name |
| Move | Ruch | A concrete next action that can be started and completed. | vague task, idea, intention |
| Artifact | Artefakt | A real output in the world: call made, message sent, shipped file, decision delivered. | "progress" without output |
| Evidence | Dowód | Factual record that something happened. Evidence is not interpretation. | proof, insight, AI memory |
| Reflection | Refleksja | User-given meaning after the fact: what mattered, what cost something, what to change. | AI diagnosis |
| Note | Notatka | Parking space for raw thoughts, snippets, drafts, and non-committed material. | task, plan |
| Task | Zadanie | Backlog item that may become a move inside a plan. | todo as a product label |
| Goal | Cel kierunkowy | Directional outcome that gives context to plans and moves. | vague aspiration |
| Project | Projekt | Container for related moves, evidence, and decisions in a domain. | folder, category |
| Pattern | Wzorzec | Repeated observation with explicit N/evidence. | confirmed truth without sample size |

## UI Rules

- Use `Plan dnia` instead of `Power List` in visible copy.
- Use `Zadania` instead of `Todo` in visible copy, unless referring to a technical integration/history.
- Use `Notatki` instead of `Keep` in visible copy.
- Use `Dowody` for factual logs and `Refleksja` for user interpretation.
- Use `Artefakt dnia` only for externally visible output, not for notes or planning.

## Agent Rules

When changing product copy, preserve the distinction:

- Plan says what should happen.
- Move is what gets executed.
- Evidence says what happened.
- Reflection says what the user thinks it meant.
- Pattern needs repeated evidence and an explicit sample size.
