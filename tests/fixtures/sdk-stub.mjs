// Minimal @hermes/plugin-sdk stand-in for jsdom tests (resolved via tests/fixtures/sdk-loader.mjs).
import { createElement as h } from 'react'
export const TRANSCRIPT_DIRECTIVE_AREA = 'transcript.directives'
export const host = { notify() {}, notifyError() {} }
export const Badge = ({ children, variant, size, asChild, ...rest }) => h('span', { 'data-slot': 'badge', 'data-variant': variant, 'data-size': size, ...rest }, children)
export const Button = ({ children, ...rest }) => h('button', rest, children)
export const Tip = ({ label, children }) => h('span', { 'data-slot': 'tip', 'data-tip': typeof label === 'string' ? label : '' }, children)
export const Tooltip = ({ children }) => children
// #37: the real SDK exports Dialog* (apps/desktop/src/sdk/index.ts: Dialog, DialogContent,
// DialogTitle, …). Radix semantics: Dialog mounts its content only while open.
export const Dialog = ({ open, children }) => (open ? children : null)
export const DialogContent = ({ children, fitContent, ...rest }) => h('div', { role: 'dialog', ...rest }, children)
export const DialogTitle = ({ children, ...rest }) => h('h2', rest, children)
export const ScrollArea = ({ children, ...rest }) => h('div', rest, children)
export const Skeleton = (props) => h('div', { 'data-slot': 'skeleton', ...props })
export const Tabs = ({ children, ...rest }) => h('div', rest, children)
export const TabsList = ({ children, ...rest }) => h('div', rest, children)
export const TabsTrigger = ({ children, ...rest }) => h('button', rest, children)
export const Popover = ({ children }) => children
export const cn = (...a) => a.filter(Boolean).join(' ')
export const useQuery = () => ({ isPending: true, isLoading: true })
