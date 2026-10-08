// Settled, read-only query fixture for the registered bundle boundary tests.
export * from '../fixtures/sdk-stub.mjs'
export function useQuery() {
  return { data: globalThis.cardBoundaryRecord, isPending: false, isLoading: false, isError: false }
}
