// node:module registerHooks() resolve hook (sync): maps '@hermes/plugin-sdk' to the test stub.
export function resolve(specifier, context, next) {
  if (specifier === '@hermes/plugin-sdk') return { url: new URL('./sdk-stub.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
}
