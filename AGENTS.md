Always output a architectural breakdown of structural code changes and wait for manual user confirmation before editing disk files.

# Antigravity Multi-Project Code Rules

## Architecture Memory Layer
The entire repository suite is structurally indexed in a local, offline database file located one folder up at: `../.code-review-graph/graph.db`

## Automated Tool Priority Heuristics
You must strictly follow this tool selection hierarchy when answering user prompts:

1. **Multi-Project / Cross-App Queries:** Before running ANY standard filesystem read, `grep`, or file search across directories, you must query the local code intelligence graph database at `../.code-review-graph/graph.db`. Use it to evaluate call structures, shared interfaces, and blast-radius impacts.
2. **Local Fallback:** Fall back to basic file readers or text matching ONLY when the structural graph database cannot answer the query.

## Core Objective
Leverage the structural graph database automatically to bridge visibility between SuiteUtils and its sibling applications (TokenMarket, PlanTune, ag-video-system).


