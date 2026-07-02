import type { WorkspaceKey } from "@kip/agents";

export type MemoryKind =
  | "company"
  | "conversation"
  | "decision"
  | "document"
  | "project"
  | "task"
  | "integration";

export type MemorySensitivity = "public" | "internal" | "confidential" | "restricted";

export type MemoryRecord = {
  readonly id: string;
  readonly workspace: WorkspaceKey;
  readonly kind: MemoryKind;
  readonly title: string;
  readonly body: string;
  readonly source: string;
  readonly sensitivity: MemorySensitivity;
  readonly tags: readonly string[];
  readonly embedding: readonly number[];
  readonly importance: number;
  readonly confidence: number;
  readonly recency: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MemoryNamespace = {
  readonly workspace: WorkspaceKey;
  readonly tableName: "kip_memory";
  readonly embeddingModel: "text-embedding-3-large";
  readonly embeddingDimensions: 3072;
  readonly retentionPolicy: "workspace-controlled";
  readonly searchableKinds: readonly MemoryKind[];
};

export type MemorySearchRequest = {
  readonly workspace: WorkspaceKey;
  readonly query: string;
  readonly matchCount: number;
  readonly kinds?: readonly MemoryKind[];
  readonly minimumScore?: number;
};

export type MemorySearchResult = Pick<
  MemoryRecord,
  "id" | "workspace" | "kind" | "title" | "body" | "source" | "sensitivity" | "tags"
> & {
  readonly semanticScore: number;
  readonly memoryScore: number;
};

export const memoryKinds = [
  "company",
  "conversation",
  "decision",
  "document",
  "project",
  "task",
  "integration"
] as const satisfies readonly MemoryKind[];

export const supabaseMemorySchema = String.raw`
create extension if not exists vector;

create table if not exists public.kip_memory (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,
  kind text not null,
  title text not null,
  body text not null,
  source text not null,
  sensitivity text not null,
  tags text[] not null default '{}',
  embedding vector(3072) not null,
  importance numeric not null default 0.5,
  confidence numeric not null default 0.8,
  recency numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kip_memory_score_bounds check (
    importance between 0 and 1 and confidence between 0 and 1 and recency between 0 and 1
  )
);

create index if not exists kip_memory_workspace_kind_idx on public.kip_memory (workspace, kind);
create index if not exists kip_memory_embedding_idx on public.kip_memory using ivfflat (embedding vector_cosine_ops);

create or replace function public.match_kip_memory(
  query_embedding vector(3072),
  requested_workspace text,
  requested_kinds text[],
  match_count int,
  minimum_score numeric default 0
)
returns table (
  id uuid,
  workspace text,
  kind text,
  title text,
  body text,
  source text,
  sensitivity text,
  tags text[],
  semantic_score numeric,
  memory_score numeric
)
language sql stable
as $$
  select
    m.id,
    m.workspace,
    m.kind,
    m.title,
    m.body,
    m.source,
    m.sensitivity,
    m.tags,
    1 - (m.embedding <=> query_embedding) as semantic_score,
    ((1 - (m.embedding <=> query_embedding)) * 0.55 + m.importance * 0.25 + m.confidence * 0.15 + m.recency * 0.05) as memory_score
  from public.kip_memory m
  where m.workspace = requested_workspace
    and (array_length(requested_kinds, 1) is null or m.kind = any(requested_kinds))
    and (1 - (m.embedding <=> query_embedding)) >= minimum_score
  order by memory_score desc
  limit match_count;
$$;
`;

export function createMemoryNamespace(workspace: WorkspaceKey): MemoryNamespace {
  return {
    workspace,
    tableName: "kip_memory",
    embeddingModel: "text-embedding-3-large",
    embeddingDimensions: 3072,
    retentionPolicy: "workspace-controlled",
    searchableKinds: memoryKinds
  };
}

export function calculateMemoryScore(input: {
  readonly semanticScore: number;
  readonly importance: number;
  readonly confidence: number;
  readonly recency: number;
}): number {
  return input.semanticScore * 0.55 + input.importance * 0.25 + input.confidence * 0.15 + input.recency * 0.05;
}

export function createMemorySearchRequest(
  workspace: WorkspaceKey,
  query: string,
  options: Partial<Omit<MemorySearchRequest, "workspace" | "query">> = {}
): MemorySearchRequest {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    throw new Error("Memory search query must not be empty.");
  }

  return {
    workspace,
    query: normalizedQuery,
    matchCount: options.matchCount ?? 12,
    kinds: options.kinds,
    minimumScore: options.minimumScore ?? 0.72
  };
}
