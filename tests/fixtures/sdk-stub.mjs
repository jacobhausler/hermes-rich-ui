// Minimal @hermes/plugin-sdk stand-in for jsdom tests (resolved via tests/fixtures/sdk-loader.mjs).
import { createElement as h, cloneElement, createContext, useContext } from 'react'
// Dialog exports mirror the stock SDK's controlled Root/Trigger/Content/Title
// contract. Real portal, focus trapping and Escape handling remain host-owned.
const DialogContext = createContext(null)
export const Dialog = ({ open, onOpenChange, children }) => h(DialogContext.Provider, { value: { open, onOpenChange } }, children)
export const DialogTrigger = ({ asChild, children }) => {
  const { onOpenChange } = useContext(DialogContext)
  const onClick = e => { children.props.onClick?.(e); if (!e.defaultPrevented) onOpenChange(true) }
  return asChild ? cloneElement(children, { onClick }) : h('button', { type: 'button', onClick }, children)
}
export const DialogContent = ({ children, fitContent, ...rest }) => {
  const { open, onOpenChange } = useContext(DialogContext)
  return open ? h('div', { role: 'dialog', 'aria-modal': true, ...rest }, children,
    h('button', { type: 'button', 'aria-label': 'Close', onClick: () => onOpenChange(false) }, 'Close')) : null
}
export const DialogTitle = props => h('h2', { 'data-slot': 'dialog-title', ...props })
export const TRANSCRIPT_DIRECTIVE_AREA = 'transcript.directives'
export const host = { notify() {}, notifyError() {} }
export const Badge = ({ children, variant, size, asChild, ...rest }) => h('span', { 'data-slot': 'badge', 'data-variant': variant, 'data-size': size, ...rest }, children)
export const Button = ({ children, ...rest }) => h('button', rest, children)
export const Tip = ({ label, children }) => h('span', { 'data-slot': 'tip', 'data-tip': typeof label === 'string' ? label : '' }, children)
export const Tooltip = ({ children }) => children
export const ScrollArea = ({ children, ...rest }) => h('div', rest, children)
export const Skeleton = (props) => h('div', { 'data-slot': 'skeleton', ...props })
export const Tabs = ({ children, ...rest }) => h('div', rest, children)
export const TabsList = ({ children, ...rest }) => h('div', rest, children)
export const TabsTrigger = ({ children, ...rest }) => h('button', rest, children)
export const Popover = ({ children }) => children
export const cn = (...a) => a.filter(Boolean).join(' ')
export const useQuery = () => ({ isPending: true, isLoading: true })
