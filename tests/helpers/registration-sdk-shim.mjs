// Test-local @hermes/plugin-sdk shim for tests/test_registration_repro.mjs ONLY.
// Re-exports the shared stub and overrides ONLY useQuery: the shared stub pins
// isPending:true, which would leave RichCard on the Skeleton forever and hide the
// settled-prose seam. Here useQuery runs queryFn to resolution against the fake
// host's ctx.rest. NEVER import this from other render tests; never edit the stub.
export * from '../fixtures/sdk-stub.mjs'

const cache = new Map()
export function __resetQueryCache() { cache.clear() }

export function useQuery({ queryKey, queryFn, enabled = true }) {
  const key = JSON.stringify(queryKey)
  if (enabled && !cache.has(key)) {
    cache.set(key, { status: 'pending' })
    queryFn().then(
      d => cache.set(key, { status: 'success', data: d }),
      e => cache.set(key, { status: 'error', error: e })
    )
  }
  const e = cache.get(key) || { status: 'pending' }
  return { data: e.data, isPending: e.status === 'pending', isLoading: e.status === 'pending', isError: e.status === 'error', error: e.error }
}
