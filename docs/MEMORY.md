# Memory system

Types: short-term (recent turns), long-term items (`userFacts`, `sharedExperiences`, `importantEvents`, `longTermMemory`), `conversationSummary`.
Each item: `{ id, type, content, importance 0–100, timestamp, tags }`.

* **Importance** guide (also given to the model): 20 trivia · 40 preference · 60 ongoing project · 90 the user said "remember this / important". Explicit phrases ("기억해", "remember this") force ≥ 90.
* **Retention**: `importance · 0.5^(age / halfLife)`, `halfLife = 3 + (importance/100)² · 400` days. Items < 4 are pruned unless importance ≥ 85. Cap 200 items.
* **Dedupe**: token-Jaccard > 0.7 merges (keeps max importance, refreshes timestamp).
* **Retrieval**: Korean bigrams + latin words + tag hits + retention + importance boost → top 8 go into the prompt.
* **Summaries**: after 14 assistant turns the older turns are folded into a ≤ 120-word summary by Claude (`mode: "summarize"`); the last 8 turns stay verbatim.
* **Never stored**: anything that looks like a key, token, password, card number.

## Stores
| Setting | Store | Where |
|---|---|---|
| This device (default) | `LocalMemoryStore` | `localStorage["spider-ai:memory:v1"]` |
| This session only | `SessionMemoryStore` | RAM |
| Cloud | `CloudMemoryStore` → `/api/memory` | Supabase |

## Supabase setup (optional)
```sql
create table if not exists spider_memory (
  uid text primary key check (uid ~ '^[a-f0-9]{32}$'),
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
alter table spider_memory enable row level security;   -- no policies: only the service key (server) can read/write
```
Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in the server environment. The 128-bit `uid` acts as a bearer secret; treat it like a password (it lives in `localStorage["spider-ai:uid"]`).
Settings → Privacy → **Delete all my data** wipes local memory and asks the server to delete the row.
