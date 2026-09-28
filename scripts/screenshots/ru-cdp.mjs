// Single-session card screenshotter for the isolated Hermes Desktop (CDP :9333).
//   node ru-cdp.mjs card <card_id> <out.png>   -> scroll the card into view, settle, measure, clip-shot, all in ONE session
//   node ru-cdp.mjs full <out.png>             -> viewport shot
//   node ru-cdp.mjs eval "<expr>"
// Tall cards: the emulated viewport is grown to fit the card (Emulation.setDeviceMetricsOverride) so no
// "Show more" / scroll seams; restored afterwards.
const PORT = 9333
const [cmd, ...args] = process.argv.slice(2)
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
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fs = await import('node:fs')

// Returns the card rect after scrolling it to the top of its scroll container.
const SCROLL_AND_MEASURE = id => `(() => {
  const c = document.querySelector('[data-ru-card="${id}"]'); if (!c) return { err: 'NO CARD' }
  const b = c.querySelector('[data-ru-toggle]'); if (b && b.textContent === 'Show more') b.click()
  c.scrollIntoView({ block: 'start', behavior: 'instant' })
  let sc = c.parentElement
  while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement
  if (sc) sc.scrollTop -= 72  // clear the app's sticky user-turn bar
  const r = c.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, tag: sc ? sc.tagName + '.' + String(sc.className).slice(0, 40) : 'none' }
})()`
const MEASURE = id => `(() => { const c = document.querySelector('[data-ru-card="${id}"]'); const r = c.getBoundingClientRect();
  // overlap guard: no OTHER card's rect may intersect ours (virtualised thread re-layout race)
  const others = [...document.querySelectorAll('[data-ru-card]')].filter(o => o !== c).map(o => o.getBoundingClientRect())
  const overlap = others.some(o => o.bottom > r.top + 1 && o.top < r.bottom - 1)
  return { x: r.x, y: r.y, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, overlap,
    title: (c.querySelector('[data-ru="Card"] header') || c).textContent.trim().slice(0, 60) } })()`

try {
  if (cmd === 'eval') {
    console.log(JSON.stringify(await evaluate(args[0])))
  } else if (cmd === 'full') {
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(args[0], Buffer.from(data, 'base64')); console.log('wrote', args[0])
  } else if (cmd === 'tall') {
    await send('Emulation.setDeviceMetricsOverride', { width: +(args[0] || 1280), height: +(args[1] || 1800), deviceScaleFactor: 2, mobile: false })
    await sleep(500); console.log(JSON.stringify(await evaluate('[innerWidth, innerHeight]')))
  } else if (cmd === 'untall') {
    await send('Emulation.clearDeviceMetricsOverride'); console.log('cleared')
  } else if (cmd === 'card') {
    const [id, out] = args
    const onScreen = m => m.y >= 0 && m.y + m.h <= m.vh
    let m, r
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        // stick-to-bottom releases only on a user scroll gesture: nudge with a wheel event over the thread
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 400, deltaX: 0, deltaY: -120 })
        await sleep(300)
      }
      m = await evaluate(SCROLL_AND_MEASURE(id))
      if (m.err) throw new Error(m.err)
      let last = null, stable = 0
      for (let i = 0; i < 30; i++) {
        await sleep(250)
        m = await evaluate(SCROLL_AND_MEASURE(id))
        if (last && Math.abs(last.y - m.y) < 1 && Math.abs(last.h - m.h) < 1 && onScreen(m)) { if (++stable >= 2) break } else stable = 0
        last = m
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 })
      await sleep(600)
      r = await evaluate(MEASURE(id))
      if (onScreen(r) && !r.overlap) break
    }
    if (!onScreen(r)) throw new Error('card did not settle on screen: ' + JSON.stringify(r))
    if (r.overlap) throw new Error('another card overlaps the clip: ' + JSON.stringify(r))
    const lm = await send('Page.getLayoutMetrics')
    // clip in CSS px with scale 2 => crisp 2x PNG of exactly the card (+8px pad), independent of page zoom
    const pad = 8
    // page zoom: clip is in device-independent px, rects are in (zoomed) CSS px
    const z = (lm.layoutViewport?.clientWidth && lm.cssLayoutViewport?.clientWidth) ? lm.layoutViewport.clientWidth / lm.cssLayoutViewport.clientWidth : 1
    const clip = { x: Math.max(0, r.x - pad) * z, y: Math.max(0, r.y - pad) * z, width: (r.w + 2 * pad) * z, height: Math.min(r.vh - Math.max(0, r.y - pad), r.h + 2 * pad) * z, scale: 2 / z }
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
    fs.writeFileSync(out, Buffer.from(data, 'base64'))
    fs.writeFileSync(out + '.json', JSON.stringify({ card: [r.x, r.y, r.w, r.h], vw: r.vw, vh: r.vh, clip, visual: lm.cssVisualViewport, layout: lm.cssLayoutViewport }))
    const fit = r.y >= 0 && r.y + r.h <= r.vh
    console.log(JSON.stringify({ out: out.split('/').pop(), title: r.title, z, card: [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)], vh: r.vh, fit }))
  }
} finally { ws.close() }
