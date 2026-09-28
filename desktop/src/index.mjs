// hermes-rich-ui — desktop half. Plain ESM bundled by scripts/build.mjs into desktop/plugin.js.
// Imports only @hermes/plugin-sdk, react, react/jsx-runtime (+ bundled @json-render/react, uplot).
import { TRANSCRIPT_DIRECTIVE_AREA } from '@hermes/plugin-sdk'
import { jsx } from 'react/jsx-runtime'
import { useStateStore } from '@json-render/react'
import { components } from './components/index.mjs'
import { makeRichCard, setRest } from './card.mjs'
import { setOpenExternal } from './components/sourcelist.mjs'

// Every component receives the card's /meta/sources as props._sources so per-component
// `sourceIds` superscripts (and SourceList's default "all sources") can resolve labels.
function withSources(Comp) {
  const Wrapped = (props) => {
    const store = useStateStore()
    const sources = store.get('/meta/sources')
    const element = props.element
    const merged = { ...element, props: { ...(element?.props ?? {}), _sources: Array.isArray(sources) ? sources : [] } }
    return jsx(Comp, { ...props, element: merged })
  }
  Wrapped.displayName = 'RichUI(' + (Comp.displayName || Comp.name || 'Component') + ')'
  return Wrapped
}

function withMetaSources(Comp) {
  // SourceList reads props.sources; inject /meta/sources there too.
  const Wrapped = (props) => {
    const store = useStateStore()
    const sources = store.get('/meta/sources')
    const element = props.element
    const list = Array.isArray(sources) ? sources : []
    const merged = { ...element, props: { ...(element?.props ?? {}), sources: list, _sources: list } }
    return jsx(Comp, { ...props, element: merged })
  }
  Wrapped.displayName = 'RichUI(SourceList)'
  return Wrapped
}

export const registry = Object.fromEntries(
  Object.entries(components).map(([k, C]) => [k, k === 'SourceList' ? withMetaSources(C) : withSources(C)])
)

export const RichCard = makeRichCard(registry)

export default {
  id: 'hermes-rich-ui',
  name: 'Rich UI',
  register(ctx) {
    setRest((path, opts) => ctx.rest(path, opts))
    setOpenExternal(ctx.os && ctx.os.openExternal ? url => ctx.os.openExternal(url) : null)
    ctx.register({
      id: 'directive',
      area: TRANSCRIPT_DIRECTIVE_AREA,
      data: { name: 'richui', render: ({ attrs }) => jsx(RichCard, { id: String(attrs?.id ?? '') }) }
    })
  }
}
