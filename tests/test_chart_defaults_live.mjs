// #35: exercise the COMMITTED bundle through the real renderer in Chromium.
// No recorded-skip fallback: the chart gate needs actual canvas metrics and hover.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromiumGate, launchChromium } from './helpers/chromium.mjs'

const gate = chromiumGate()
const { outputFiles } = await build({
  stdin: { contents: `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import plugin from './desktop/plugin.js'
    let claim, root
    plugin.register({ register: c => { claim = c.data }, rest: async () => ({card: globalThis.record}), os: {openExternal(){}} })
    globalThis.mountRecord = async record => {
      if (root) root.unmount()
      globalThis.record = record
      root = createRoot(document.getElementById('mount'))
      root.render(claim.render({attrs: {id: record.envelope.card_id}, source: {}}))
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  `, resolveDir: process.cwd(), loader: 'js' },
  bundle: true, format: 'iife', write: false,
  plugins: [{ name: 'test-host-sdk', setup(b) {
    b.onResolve({ filter: /^@hermes\/plugin-sdk$/ }, () => ({ path: 'sdk', namespace: 'test' }))
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
      contents: `export * from './tests/fixtures/sdk-stub.mjs';
        import {useState,useEffect} from 'react';
        export function useQuery({queryFn,queryKey}) {
          const [data,setData] = useState(null);
          useEffect(() => { let live=true; queryFn().then(d => {if(live)setData(d)}); return () => {live=false} }, [JSON.stringify(queryKey)]);
          return {data,isPending:data===null,isLoading:data===null};
        }`, resolveDir: process.cwd(), loader: 'js'
    }))
  }}]
})
const code = outputFiles[0].text
const saved = JSON.parse(readFileSync(new URL('./fixtures/saved/ru-f3af0e45428d.json', import.meta.url)))
const money = structuredClone(saved)
money.surface.createSurface.components = [
  { id: 'root', component: 'Card', title: 'Chart gate', children: ['chart'] },
  { id: 'chart', component: 'Chart', kind: 'bar', unit: 'USD', series: [{ label: 'Revenue', data: [
    { label: 'Q1', value: 0 }, { label: 'Q2', value: 2e9 }, { label: 'Q3', value: 2.5e9 }
  ] }] }
]

async function page() {
  assert.equal(gate.run, true, gate.reason)
  const browser = await launchChromium(gate.bin)
  await browser.evaluate(`(() => {
    document.head.innerHTML = '<style>:root{--ui-accent:#3b82f6;--ui-orange:#f97316;--ui-purple:#a855f7;--ui-green:#22c55e;--ui-text-primary:#e5e7eb;--ui-text-secondary:#9ca3af;--ui-text-tertiary:#6b7280;--ui-stroke-tertiary:#374151;--ui-stroke-secondary:#4b5563;--ui-bg-tertiary:#1f2937;--ui-bg-elevated:#111827}body{background:#111827;color:#e5e7eb;margin:16px}</style>'
    document.body.innerHTML = '<div id="mount" style="width:720px"></div>'
    globalThis.paints = []
    const real = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function(text,x,y,...rest) {
      const width = this.measureText(text).width
      const left = this.textAlign === 'right' ? x-width : this.textAlign === 'center' ? x-width/2 : x
      paints.push({text,left,right:left+width,y,canvasWidth:this.canvas.width,font:this.font})
      return real.call(this,text,x,y,...rest)
    }
  })()`)
  await browser.evaluate(code)
  return browser
}

function assertTicksFit(paints) {
  const ticks = paints.filter(p => /^[$−\d]/.test(p.text))
  assert.ok(ticks.length > 0, 'actual ticks painted')
  for (const p of ticks) {
    assert.ok(p.left >= 0 && p.right <= p.canvasWidth, `unclipped tick ${JSON.stringify(p)}`)
  }
}

async function shot(browser, name) {
  if (!process.env.RUI_CHART_SHOTS) return
  const pngs = await browser.evaluate(`Array.from(document.querySelectorAll('[data-richui="chart-canvas"] canvas'), c => c.toDataURL('image/png').split(',')[1])`)
  mkdirSync(process.env.RUI_CHART_SHOTS, { recursive: true })
  pngs.forEach((png, i) => writeFileSync(`${process.env.RUI_CHART_SHOTS}/${name}-${i}.png`, Buffer.from(png, 'base64')))
}

test('#35 live bundle: title, hidden single legend, measured ticks and exact hover line', async () => {
  const browser = await page()
  try {
    await browser.evaluate(`mountRecord(${JSON.stringify(money)})`)
    const view = await browser.evaluate(`(() => {
      const f = document.querySelector('figure[data-richui="chart"]')
      const over = f.querySelector('.u-over'), r = over.getBoundingClientRect()
      over.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,clientX:r.left+r.width*5/6,clientY:r.top+r.height/2}))
      return {title:f.querySelector('div > span').textContent, legend:!!f.querySelector('.u-legend'), height:f.dataset.height, paints}
    })()`)
    assert.equal(view.title, 'Revenue')
    assert.equal(view.legend, false)
    assert.equal(view.height, '180')
    assertTicksFit(view.paints)
    assert.equal(await browser.evaluate(`document.querySelector('[data-richui="chart-readout"]')?.textContent`), 'Q3 · Revenue: $2,500,000,000')
    await shot(browser, 'money')
  } finally { browser.close() }
})

test('#35 live bundle: saved f3af charts retain geometry and paint unclipped y ticks', async () => {
  const browser = await page()
  try {
    await browser.evaluate(`mountRecord(${JSON.stringify(saved)})`)
    const state = await browser.evaluate(`({errors:document.querySelectorAll('[data-ru-error]').length, charts:document.querySelectorAll('figure[data-richui="chart"]').length, heights:Array.from(document.querySelectorAll('figure[data-richui="chart"]'), f=>f.dataset.height), paints})`)
    assert.equal(state.errors, 0)
    assert.equal(state.charts, 3)
    assert.deepEqual(state.heights, ['300', '220', '220'])
    assertTicksFit(state.paints)
    await shot(browser, 'saved-f3af')
  } finally { browser.close() }
})
