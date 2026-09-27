import { vi } from 'vitest'

// A minimal stand-in for the shape every lib/*.ts function actually uses off
// supabase-js's query/RPC builders: a chain of filter methods that all
// return the same builder, terminating in an await (or an explicit
// .then()) that resolves to { data, error, count }. Real PostgrestBuilders
// work the same way - they're thenables, not Promises - so this only needs
// to implement `then` plus every chain method the app calls, not the full
// supabase-js surface.
export interface QueryResult<T = unknown> {
  data: T | null
  error: { message: string } | null
  count?: number | null
}

export const queryResult = <T,>(data: T | null, error: { message: string } | null = null, count: number | null = null): QueryResult<T> => ({ data, error, count })

export class QueryBuilderMock<T = unknown> implements PromiseLike<QueryResult<T>> {
  private readonly result: QueryResult<T>

  constructor(result: QueryResult<T>) {
    this.result = result
  }

  select(): QueryBuilderMock<T> { return this }
  insert(): QueryBuilderMock<T> { return this }
  update(): QueryBuilderMock<T> { return this }
  delete(): QueryBuilderMock<T> { return this }
  upsert(): QueryBuilderMock<T> { return this }
  eq(): QueryBuilderMock<T> { return this }
  neq(): QueryBuilderMock<T> { return this }
  in(): QueryBuilderMock<T> { return this }
  or(): QueryBuilderMock<T> { return this }
  order(): QueryBuilderMock<T> { return this }
  limit(): QueryBuilderMock<T> { return this }
  range(): QueryBuilderMock<T> { return this }
  single(): QueryBuilderMock<T> { return this }
  maybeSingle(): QueryBuilderMock<T> { return this }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

// Convenience constructor: mockQuery(data) / mockQuery(data, error) / mockQuery(null, error, count).
export const mockQuery = <T,>(data: T | null, error: { message: string } | null = null, count: number | null = null): QueryBuilderMock<T> => new QueryBuilderMock(queryResult(data, error, count))

export interface StorageBucketMock {
  upload: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  getPublicUrl: ReturnType<typeof vi.fn>
}

export interface SupabaseMock {
  from: ReturnType<typeof vi.fn>
  rpc: ReturnType<typeof vi.fn>
  auth: {
    getSession: ReturnType<typeof vi.fn>
    onAuthStateChange: ReturnType<typeof vi.fn>
    signInWithPassword: ReturnType<typeof vi.fn>
    signUp: ReturnType<typeof vi.fn>
    signOut: ReturnType<typeof vi.fn>
    updateUser: ReturnType<typeof vi.fn>
  }
  storage: {
    from: ReturnType<typeof vi.fn>
  }
}

const createStorageBucketMock = (): StorageBucketMock => ({
  upload: vi.fn(async () => ({ data: { path: 'mock/path' }, error: null })),
  remove: vi.fn(async () => ({ data: [], error: null })),
  list: vi.fn(async () => ({ data: [], error: null })),
  getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://test.supabase.local/storage/v1/object/public/mock-bucket/${path}` } })),
})

// Fresh, independent mock per call - tests should build one in beforeEach
// (or at module scope, referenced through vi.mock's factory) rather than
// share a single instance across test files.
export const createSupabaseMock = (): SupabaseMock => ({
  from: vi.fn(() => mockQuery(null)),
  rpc: vi.fn(() => mockQuery(null)),
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    signUp: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
  },
  storage: {
    from: vi.fn(() => createStorageBucketMock()),
  },
})

// Dispatches supabase.from(table) / supabase.rpc(name) calls to per-name
// query builders, so a test can say "posts -> these rows, profiles -> those
// rows" instead of hand-rolling a switch in every file.
export const byName = (table: Record<string, QueryBuilderMock>, fallback: QueryBuilderMock = mockQuery(null)) => vi.fn((name: string) => table[name] ?? fallback)
