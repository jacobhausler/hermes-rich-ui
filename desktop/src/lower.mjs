// A2UI v1.0 createSurface -> json-render spec (CONTRACTS §6). Pure, deterministic.
//
//   components[]            -> spec.elements keyed by id
//   component               -> type
//   props                   -> every key except id/component/children/child/tabs/items
//                              (accessibility + sourceIds stay inside props; Tabs/Accordion
//                              keep tabs/items in props too so the component can label them)
//   children/child/tabs[].child/items[].child -> children[]
//   { path }  (exactly one key)               -> { $state: path }, recursively (arrays too)
//   spec.root = 'root'; initialState = dataModel

const STRUCTURAL = new Set(['id', 'component', 'children', 'child', 'tabs', 'items'])
const CHILD_LIST_TYPES = new Set(['Tabs', 'Accordion'])
export const KNOWN_TYPES = new Set([
  'Card', 'Stack', 'Grid', 'Divider', 'Tabs', 'Accordion', 'Heading', 'Text', 'Callout', 'Badge',
  'Metric', 'Progress', 'KeyValueList', 'Image', 'DataTable', 'Chart', 'Timeline', 'SourceList',
  'CodeBlock', 'Checklist', 'ChipSet', 'AsOf', 'ImageGallery', 'Sparkline', 'BarList', 'HeatMap'
])
const SURFACE_KEYS = new Set(['surfaceId', 'catalogId', 'components', 'dataModel', 'metadata'])

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v)
// Admission rejects these keys anywhere; the lowering ignores them too (defense in depth) so a
// JSON own-key '__proto__' can never rewire a props object's prototype.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const safeKeys = o => Object.keys(o).filter(k => !FORBIDDEN_KEYS.has(k))

// A2UI DataBinding is an object whose only key is `path`.
const isBinding = v => isObj(v) && Object.keys(v).length === 1 && typeof v.path === 'string'

export function bind(value) {
  if (Array.isArray(value)) return value.map(bind)
  if (isBinding(value)) return { $state: value.path }
  if (isObj(value)) {
    const out = {}
    for (const k of safeKeys(value)) out[k] = bind(value[k])
    return out
  }
  return value
}

function childIds(c) {
  const ids = []
  if (c.children !== undefined) {
    // A2UI allows a template object here ({componentId, path}); the fence forbids it.
    if (!Array.isArray(c.children)) throw new Error(`${c.id}: children must be an explicit id array (template ChildList is not allowed)`)
    ids.push(...c.children)
  }
  if (typeof c.child === 'string') ids.push(c.child)
  if (Array.isArray(c.tabs)) for (const t of c.tabs) if (t && typeof t.child === 'string') ids.push(t.child)
  if (Array.isArray(c.items) && CHILD_LIST_TYPES.has(c.component)) for (const t of c.items) if (t && typeof t.child === 'string') ids.push(t.child)
  return ids.map(String)
}

export function lower(createSurface) {
  const components = Array.isArray(createSurface?.components) ? createSurface.components : []
  // Null-prototype dictionary: an id of '__proto__' / 'constructor' becomes an OWN key and can
  // never reach Object.prototype (D1, review/sec/desktop_probe.mjs).
  const elements = Object.create(null)
  for (const c of components) {
    if (!isObj(c) || typeof c.id !== 'string') throw new Error('component without a string id')
    const props = {}
    for (const k of safeKeys(c)) {
      if (STRUCTURAL.has(k)) continue
      props[k] = bind(c[k])
    }
    // KeyValueList/Timeline `items` are data (DynamicArray), not children; Tabs/Accordion keep
    // their tab/item descriptors (with child ids) so the component can label panels.
    if (Array.isArray(c.tabs)) props.tabs = bind(c.tabs)
    if (c.items !== undefined) props.items = bind(c.items)
    elements[c.id] = { type: String(c.component), props, children: childIds(c) }
  }
  const dm = createSurface?.dataModel
  const initialState = isObj(dm) ? dm : {}
  return { spec: { root: 'root', elements }, initialState }
}

// Reasons a surface cannot be lowered/rendered. The card shows these instead of the body.
export function unlowerable(createSurface) {
  const reasons = []
  if (!isObj(createSurface)) return ['createSurface is not an object']
  for (const k of Object.keys(createSurface)) if (!SURFACE_KEYS.has(k)) reasons.push(`unknown surface key: ${k}`)
  const components = createSurface.components
  if (!Array.isArray(components)) return [...reasons, 'components is not an array']
  const ids = new Set()
  for (const c of components) {
    if (!isObj(c) || typeof c.id !== 'string') { reasons.push('component without a string id'); continue }
    if (ids.has(c.id)) reasons.push(`${c.id}: duplicate id`)
    ids.add(c.id)
    if (typeof c.component !== 'string') reasons.push(`${c.id}: missing component`)
    else if (!KNOWN_TYPES.has(c.component)) reasons.push(`${c.id}: unknown component ${c.component}`)
    if (c.children !== undefined && !Array.isArray(c.children)) reasons.push(`${c.id}: template ChildList is not allowed`)
  }
  if (!ids.has('root')) reasons.push('missing root component')
  for (const c of components) {
    if (!isObj(c)) continue
    let kids = []
    try { kids = childIds(c) } catch { continue }
    for (const k of kids) if (!ids.has(k)) reasons.push(`${c.id}: child ${k} does not resolve`)
  }
  const dm = createSurface.dataModel
  if (dm !== undefined && !isObj(dm)) reasons.push('dataModel is not an object')
  return reasons
}
