// registerHooks resolve hook for the shared harness: maps '@hermes/plugin-sdk'
// to the canonical tests/fixtures/sdk-stub.mjs.
export function resolve(specifier, context, next) {
  if (specifier === '@hermes/plugin-sdk') return { url: new URL('../fixtures/sdk-stub.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
}
