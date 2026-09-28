// Probe chart legend DOM on the isolated desktop (CDP :9333). Prints one JSON object.
const PORT = 9333
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find(t => t.type === 'page' && t.url.includes('5175') && !/pet|quick|overlay/i.test(t.url)) || targets.find(t => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r, { once: true }))
let seq = 0
const pending = new Map()
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, m => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); ws.send(JSON.stringify({ id, method, params })) })
const evaluate = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}
const expr = `(() => {
  const cards = [...document.querySelectorAll('[data-ru-card]')]
  const out = []
  for (const c of cards) {
    const legends = c.querySelectorAll('.u-legend')
    if (!legends.length) continue
    for (const l of legends) {
      out.push({
        card: c.getAttribute('data-ru-card'),
        inline: l.className,
        rows: [...l.querySelectorAll('tr')].map(r => ({ cls: r.className, disp: getComputedStyle(r).display, txt: r.textContent.trim().slice(0, 40) }))
      })
    }
    if (out.length > 6) break
  }
  return JSON.stringify(out)
})()`
try {
  console.log(await evaluate(expr))
} finally { ws.close() }
