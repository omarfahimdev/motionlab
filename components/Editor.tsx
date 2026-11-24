'use client'
import { useEffect, useRef, useState } from 'react'

type KF = { t: number; v: number }
type Prop = { v: number; kf: KF[] }
type PK = 'x' | 'y' | 'sx' | 'sy' | 'rot' | 'op'
type Layer = { id: number; name: string; type: 'solid' | 'ellipse' | 'rect' | 'text' | 'media'; color: string; text: string; inP: number; outP: number; vis: boolean; fx: FX[]; blend: string; src?: string; kind?: 'video' | 'image'; p: Record<PK, Prop> }

const W = 1280, H = 720, DUR = 10, FPS = 30
const LABELS: [PK, string][] = [['x', 'Position X'], ['y', 'Position Y'], ['sx', 'Scale X %'], ['sy', 'Scale Y %'], ['rot', 'Rotation °'], ['op', 'Opacity %']]
const P = (v: number): Prop => ({ v, kf: [] })
const smooth = (u: number) => u * u * (3 - 2 * u)

const val = (p: Prop, t: number, easy: boolean) => {
  const k = p.kf
  if (!k.length) return p.v
  if (t <= k[0].t) return k[0].v
  const l = k[k.length - 1]
  if (t >= l.t) return l.v
  let i = 0
  while (k[i + 1].t < t) i++
  const u = (t - k[i].t) / (k[i + 1].t - k[i].t)
  return k[i].v + (k[i + 1].v - k[i].v) * (easy ? smooth(u) : u)
}

let uid = 10
const mk = (type: Layer['type'], name: string, color: string, x = W / 2, y = H / 2): Layer => ({
  id: ++uid, name, type, color, text: 'Title', inP: 0, outP: DUR, vis: true, fx: [], blend: 'source-over',
  p: { x: P(x), y: P(y), sx: P(100), sy: P(100), rot: P(0), op: P(100) },
})

const initial = (): Layer[] => {
  const txt = mk('text', 'Title text', '#ffffff'); txt.text = 'MotionLab'
  txt.p.op.kf = [{ t: 0.3, v: 0 }, { t: 1.5, v: 100 }]; txt.p.y.kf = [{ t: 0.3, v: 420 }, { t: 1.5, v: 360 }]
  const el = mk('ellipse', 'Orb', '#9a7bff', 200, 540)
  el.p.x.kf = [{ t: 0, v: 200 }, { t: 5, v: 1080 }, { t: 10, v: 200 }]
  el.p.sx.kf = [{ t: 0, v: 100 }, { t: 5, v: 160 }, { t: 10, v: 100 }]
  const r = mk('rect', 'Spinner', '#ff4d6d', 640, 180); r.p.rot.kf = [{ t: 0, v: 0 }, { t: 10, v: 360 }]
  const bg = mk('solid', 'Background', '#16161f')
  return [txt, r, el, bg]
}

const media = new Map<number, any>()
const draw = (c: HTMLCanvasElement, ls: Layer[], t: number, easy: boolean) => {
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
  for (const l of [...ls].reverse()) {
    if (!l.vis || t < l.inP || t > l.outP) continue
    const v = (k: PK) => val(l.p[k], t, easy)
    g.save()
    g.globalAlpha = Math.max(0, Math.min(1, v('op') / 100))
    g.filter = fxStr(l.fx) || 'none'; g.globalCompositeOperation = l.blend as GlobalCompositeOperation
    g.translate(v('x'), v('y')); g.rotate((v('rot') * Math.PI) / 180); g.scale(v('sx') / 100, v('sy') / 100)
    g.fillStyle = l.color
    if (l.type === 'solid') g.fillRect(-W / 2, -H / 2, W, H)
    if (l.type === 'rect') g.fillRect(-150, -90, 300, 180)
    if (l.type === 'media') { const m = media.get(l.id); const w = m && (m.videoWidth || m.naturalWidth), h = m && (m.videoHeight || m.naturalHeight); if (w) g.drawImage(m, -w / 2, -h / 2, w, h) }
    if (l.type === 'ellipse') { g.beginPath(); g.ellipse(0, 0, 110, 110, 0, 0, 7); g.fill() }
    if (l.type === 'text') { g.font = '700 110px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l.text, 0, 0) }
    g.restore()
  }
}

type FX = { id: number; k: string; v: number }
const FXDEF: Record<string, { label: string; def: number; min: number; max: number; f: (v: number) => string }> = {
  blur: { label: 'Gaussian blur', def: 8, min: 0, max: 60, f: v => `blur(${v}px)` },
  brightness: { label: 'Brightness', def: 130, min: 0, max: 300, f: v => `brightness(${v}%)` },
  contrast: { label: 'Contrast', def: 140, min: 0, max: 400, f: v => `contrast(${v}%)` },
  saturate: { label: 'Saturation', def: 160, min: 0, max: 500, f: v => `saturate(${v}%)` },
  hue: { label: 'Hue shift', def: 90, min: 0, max: 360, f: v => `hue-rotate(${v}deg)` },
  grayscale: { label: 'Black & white', def: 100, min: 0, max: 100, f: v => `grayscale(${v}%)` },
  sepia: { label: 'Sepia tone', def: 80, min: 0, max: 100, f: v => `sepia(${v}%)` },
  invert: { label: 'Invert', def: 100, min: 0, max: 100, f: v => `invert(${v}%)` },
  glow: { label: 'Glow', def: 20, min: 0, max: 80, f: v => `drop-shadow(0 0 ${v}px rgba(255,255,255,.9))` },
  shadow: { label: 'Drop shadow', def: 16, min: 0, max: 80, f: v => `drop-shadow(${v}px ${v}px ${v}px rgba(0,0,0,.7))` },
}
const fxStr = (fx: FX[]) => fx.map(e => FXDEF[e.k].f(e.v)).join(' ')
const BLENDS = ['source-over', 'multiply', 'screen', 'overlay', 'lighten', 'darken', 'color-dodge', 'difference', 'exclusion', 'lighter']
const MIME: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', gif: 'image/gif' }
const tc = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}:${String(Math.round((t % 1) * FPS) % FPS).padStart(2, '0')}`
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
const DUR_MS = (d: number) => d * 1000 + 150
const dl = (href: string, name: string) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

export default function Editor() {
  const [layers, setLayers] = useState<Layer[]>(initial)
  const [sel, setSel] = useState<number>(layers[0].id)
  const [t, setT] = useState(0)
  const [play, setPlay] = useState(false)
  const [easy, setEasy] = useState(true)
  const [zoom, setZoom] = useState(90)
  const [dur, setDur] = useState(DUR)
  const [fmt, setFmt] = useState('mp4')
  const [busy, setBusy] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const hist = useRef<Layer[][]>([])
  const cur = layers.find(l => l.id === sel)

  const commit = (fn: (ls: Layer[]) => Layer[]) => setLayers(ls => { hist.current.push(ls); return fn(ls) })
  const upd = (id: number, fn: (l: Layer) => void) => commit(ls => ls.map(l => { if (l.id !== id) return l; const c = structuredClone(l); fn(c); return c }))
  const undo = () => { const h = hist.current.pop(); if (h) setLayers(h) }

  const setProp = (id: number, k: PK, v: number) => upd(id, l => {
    const p = l.p[k]
    if (!p.kf.length) { p.v = v; return }
    const i = p.kf.findIndex(f => Math.abs(f.t - t) < 0.5 / FPS)
    if (i >= 0) p.kf[i].v = v; else { p.kf.push({ t, v }); p.kf.sort((a, b) => a.t - b.t) }
  })
  const stopwatch = (l: Layer, k: PK) => upd(l.id, c => {
    const p = c.p[k], now = val(l.p[k], t, easy)
    if (p.kf.length) { p.v = now; p.kf = [] } else p.kf = [{ t, v: now }]
  })
  const add = (type: Layer['type'], name: string, color: string) => { const l = mk(type, name, color); commit(ls => [l, ...ls]); setSel(l.id) }
  const dup = () => { if (!cur) return; const c = structuredClone(cur); c.id = ++uid; c.name += ' copy'; if (cur.kind === 'image') media.set(c.id, media.get(cur.id)); if (cur.kind === 'video') { const v = document.createElement('video'); v.src = cur.src!; v.playsInline = true; v.onseeked = () => setT(x => x + 1e-6); media.set(c.id, v) }; commit(ls => [c, ...ls]); setSel(c.id) }
  const del = () => { if (cur) { commit(ls => ls.filter(l => l.id !== cur.id)); setSel(0) } }

  useEffect(() => { if (cv.current) draw(cv.current, layers, t, easy) }, [layers, t, easy])
  useEffect(() => {
    if (!play) return
    let last = performance.now(), raf = 0
    const f = (n: number) => { const d = (n - last) / 1000; last = n; setT(x => (x + d >= dur ? 0 : x + d)); raf = requestAnimationFrame(f) }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [play])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.code === 'Space') { e.preventDefault(); setPlay(p => !p) }
      if (e.key === 'Delete' || e.key === 'Backspace') del()
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo()
      if (e.key === 'Home') setT(0)
      if (e.key === 'ArrowRight') setT(x => clamp(x + 1 / FPS, 0, dur))
      if (e.key === 'ArrowLeft') setT(x => clamp(x - 1 / FPS, 0, dur))
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  })

  const drag = (e: React.PointerEvent, fn: (dx: number, dy: number) => void) => {
    e.stopPropagation(); const x0 = e.clientX, y0 = e.clientY
    const mv = (m: PointerEvent) => fn(m.clientX - x0, m.clientY - y0)
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up) }
    addEventListener('pointermove', mv); addEventListener('pointerup', up)
  }
  const canvasDrag = (e: React.PointerEvent) => {
    if (!cur) return
    const s = W / (e.currentTarget as HTMLElement).getBoundingClientRect().width
    const x0 = val(cur.p.x, t, easy), y0 = val(cur.p.y, t, easy)
    drag(e, (dx, dy) => { setProp(cur.id, 'x', x0 + dx * s); setProp(cur.id, 'y', y0 + dy * s) })
  }
  const scrub = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    const go = (cx: number) => setT(clamp((cx - el.getBoundingClientRect().left) / zoom, 0, dur))
    go(e.clientX); drag(e, (dx) => go(e.clientX + dx))
  }
  const barDrag = (e: React.PointerEvent, l: Layer, mode: 'move' | 'in' | 'out') => {
    setSel(l.id); const { inP, outP } = l, len = outP - inP
    drag(e, dx => {
      const d = dx / zoom
      upd(l.id, c => {
        if (mode === 'move') { c.inP = clamp(inP + d, 0, dur - len); c.outP = c.inP + len }
        if (mode === 'in') c.inP = clamp(inP + d, 0, outP - 0.1)
        if (mode === 'out') c.outP = clamp(outP + d, inP + 0.1, dur)
      })
    })
  }
  const importFiles = (files: FileList | null) => Array.from(files || []).forEach(f => {
    const src = URL.createObjectURL(f), isV = f.type.startsWith('video')
    const l = mk('media', f.name, '#888'); l.src = src; l.kind = isV ? 'video' : 'image'
    const done = (el: any, w: number, h: number, d: number) => {
      media.set(l.id, el); const sc = Math.min(W / w, H / h) * 100; l.p.sx.v = sc; l.p.sy.v = sc
      l.outP = Math.min(isV ? d : dur, 120); setDur(x => Math.max(x, Math.ceil(l.outP))); commit(ls => [l, ...ls]); setSel(l.id)
    }
    if (isV) { const v = document.createElement('video'); v.src = src; v.preload = 'auto'; v.playsInline = true; v.onseeked = () => setT(x => x + 1e-6); v.onloadedmetadata = () => done(v, v.videoWidth, v.videoHeight, v.duration) }
    else { const i = new Image(); i.onload = () => done(i, i.naturalWidth, i.naturalHeight, dur); i.src = src }
  })
  useEffect(() => {
    layers.forEach(l => {
      const m = media.get(l.id); if (l.kind !== 'video' || !m) return
      const lt = t - l.inP, act = l.vis && lt >= 0 && t <= l.outP
      if (act && play) { if (m.paused) m.play().catch(() => {}); if (Math.abs(m.currentTime - lt) > 0.3) m.currentTime = lt }
      else { if (!m.paused) m.pause(); if (act && Math.abs(m.currentTime - lt) > 0.02) m.currentTime = lt }
    })
  }, [t, play, layers])
  const exportVideo = async () => {
    const c = cv.current!, ch: Blob[] = []
    const rec = new MediaRecorder(c.captureStream(FPS), { mimeType: 'video/webm', videoBitsPerSecond: 12e6 })
    rec.ondataavailable = e => ch.push(e.data)
    const stopped = new Promise<void>(r => { rec.onstop = () => r() })
    setBusy('Rendering…'); setT(0); setPlay(true); rec.start()
    await new Promise(r => setTimeout(r, DUR_MS(dur))); rec.stop(); setPlay(false); await stopped
    const webm = new Blob(ch, { type: 'video/webm' })
    if (fmt === 'webm') { dl(URL.createObjectURL(webm), 'composition.webm'); setBusy(''); return }
    try {
      setBusy('Loading encoder…')
      const { FFmpeg } = await import('@ffmpeg/ffmpeg'); const { fetchFile, toBlobURL } = await import('@ffmpeg/util')
      const ff = new FFmpeg(), base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      ff.on('progress', ({ progress }) => setBusy(`Encoding ${Math.round(Math.min(1, progress) * 100)}%`))
      await ff.load({ coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm') })
      await ff.writeFile('in.webm', await fetchFile(webm))
      const opts: Record<string, string[]> = {
        mp4: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'],
        mov: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mov'],
        gif: ['-vf', 'fps=15,scale=640:-1:flags=lanczos'],
      }
      const out = 'out.' + fmt
      await ff.exec(['-i', 'in.webm', ...opts[fmt], out])
      const data = (await ff.readFile(out)) as any
      dl(URL.createObjectURL(new Blob([data], { type: MIME[fmt] })), 'composition.' + fmt); setBusy('')
    } catch (e) {
      setBusy('Encoder unavailable — saved WebM'); dl(URL.createObjectURL(webm), 'composition.webm'); setTimeout(() => setBusy(''), 3500)
    }
  }
  const step = dur > 20 ? 5 : 1
  const ticks = Array.from({ length: Math.floor(dur / step) + 1 }, (_, i) => i * step)
  return (
    <div className="app">
      <div className="bar">
        <b>MotionLab</b>
        <button onClick={undo}>Undo</button>
        <button onClick={() => dl(cv.current!.toDataURL('image/png'), 'frame.png')}>Save frame</button>
        <button onClick={() => fileRef.current?.click()}>Import media</button>
        <input ref={fileRef} type="file" hidden multiple accept="video/*,image/*" onChange={e => { importFiles(e.target.files); e.target.value = '' }} />
        <select value={fmt} onChange={e => setFmt(e.target.value)} aria-label="Export format">
          <option value="mp4">MP4 (H.264)</option><option value="mov">MOV (QuickTime)</option><option value="webm">WebM</option><option value="gif">GIF</option>
        </select>
        <button className="on" disabled={!!busy} onClick={exportVideo}>{busy || 'Export video'}</button>
        <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>Length <input type="number" style={{ width: 52 }} min={1} max={120} value={dur} onChange={e => setDur(clamp(+e.target.value || 1, 1, 120))} />s</label>
        <span className="sp" />
        <button className={easy ? 'on' : ''} onClick={() => setEasy(!easy)}>Easy ease</button>
        <span style={{ color: 'var(--dim)' }}>1280 × 720 · {FPS} fps</span>
      </div>

      <div className="panel">
        <h4>New layer</h4>
        <div className="grid2">
          <button onClick={() => add('solid', 'Solid', '#2a6df4')}>Solid</button>
          <button onClick={() => add('rect', 'Rectangle', '#ffd166')}>Rectangle</button>
          <button onClick={() => add('ellipse', 'Ellipse', '#06d6a0')}>Ellipse</button>
          <button onClick={() => add('text', 'Text', '#ffffff')}>Text</button>
        </div>
        <h4>Layer actions</h4>
        <div className="grid2"><button onClick={dup}>Duplicate</button><button onClick={del}>Delete</button></div>
        <h4>Effects</h4>
        {cur ? (<>
          <select value="" onChange={e => { const k = e.target.value; if (k) upd(cur.id, l => { l.fx.push({ id: ++uid, k, v: FXDEF[k].def }) }) }}>
            <option value="">+ Add effect…</option>
            {Object.entries(FXDEF).map(([k, d]) => <option key={k} value={k}>{d.label}</option>)}
          </select>
          {cur.fx.map(e => { const d = FXDEF[e.k]; return (
            <div className="fx" key={e.id}>
              <div><span>{d.label} · {e.v}</span><button style={{ padding: '0 5px' }} aria-label="Remove effect" onClick={() => upd(cur.id, l => { l.fx = l.fx.filter(x => x.id !== e.id) })}>✕</button></div>
              <input type="range" min={d.min} max={d.max} value={e.v} onChange={ev => upd(cur.id, l => { l.fx.find(x => x.id === e.id)!.v = +ev.target.value })} />
            </div>) })}
          <h4 style={{ marginTop: 12 }}>Blend mode</h4>
          <select value={cur.blend} onChange={e => upd(cur.id, l => { l.blend = e.target.value })}>{BLENDS.map(b => <option key={b}>{b}</option>)}</select>
        </>) : <p style={{ color: 'var(--dim)' }}>Select a layer to add effects.</p>}
        <p style={{ color: 'var(--dim)', marginTop: 16 }}>Space play · ←/→ frame · Home start · Del remove · Ctrl+Z undo</p>
      </div>

      <div className="view" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); importFiles(e.dataTransfer.files) }}><canvas ref={cv} width={W} height={H} onPointerDown={canvasDrag} /></div>

      <div className="panel">
        <h4>{cur ? cur.name : 'No layer selected'}</h4>
        {cur && (<>
          <div className="grid2" style={{ marginBottom: 8 }}>
            <input value={cur.name} onChange={e => upd(cur.id, l => { l.name = e.target.value })} aria-label="Layer name" />
            <input type="color" value={cur.color} onChange={e => upd(cur.id, l => { l.color = e.target.value })} aria-label="Fill colour" />
          </div>
          {cur.type === 'text' && <input style={{ marginBottom: 10 }} value={cur.text} onChange={e => upd(cur.id, l => { l.text = e.target.value })} aria-label="Text" />}
          <h4>Transform</h4>
          {LABELS.map(([k, label]) => (
            <div className="prop" key={k}>
              <button className={'sw' + (cur.p[k].kf.length ? ' on' : '')} title="Toggle keyframes" onClick={() => stopwatch(cur, k)}>⏱</button>
              <span>{label}</span>
              <input type="number" value={Math.round(val(cur.p[k], t, easy) * 10) / 10} onChange={e => setProp(cur.id, k, +e.target.value)} />
            </div>
          ))}
          <p style={{ color: 'var(--dim)' }}>Turn on the stopwatch, move the playhead, then change a value to add a keyframe.</p>
        </>)}
      </div>

      <div className="tl">
        <div className="ctl">
          <button onClick={() => setT(0)}>⏮</button>
          <button className={play ? 'on' : ''} onClick={() => setPlay(!play)}>{play ? 'Pause' : 'Play'}</button>
          <span className="tm">{tc(t)}</span>
          <input type="range" min={40} max={200} value={zoom} onChange={e => setZoom(+e.target.value)} aria-label="Timeline zoom" />
        </div>
        <div className="scr" id="scr" style={{ gridRow: '1 / 3', gridColumn: 2 }}>
          <div style={{ width: dur * zoom + 40, position: 'relative' }}>
            <div className="ruler" onPointerDown={scrub} style={{ width: dur * zoom }}>
              {ticks.map(i => <div className="tick" key={i} style={{ left: i * zoom }}>{i}s</div>)}
            </div>
            {layers.map(l => {
              const times = new Set<number>(); (Object.values(l.p) as Prop[]).forEach(p => p.kf.forEach(f => times.add(f.t)))
              return (
                <div key={l.id} className={'trow' + (l.id === sel ? ' sel' : '')} style={{ width: dur * zoom }} onPointerDown={() => setSel(l.id)}>
                  <div className="bar2" style={{ left: l.inP * zoom, width: (l.outP - l.inP) * zoom, background: l.color }} onPointerDown={e => barDrag(e, l, 'move')}>
                    <i onPointerDown={e => barDrag(e, l, 'in')} /><i onPointerDown={e => barDrag(e, l, 'out')} />
                  </div>
                  {[...times].map(k => <div className="kf" key={k} style={{ left: k * zoom }} />)}
                </div>
              )
            })}
            <div className="ph" style={{ left: t * zoom }} />
          </div>
        </div>
        <div className="names" style={{ gridRow: 2, gridColumn: 1 }}>
          {layers.map(l => (
            <div key={l.id} className={'row' + (l.id === sel ? ' sel' : '')} onClick={() => setSel(l.id)}>
              <button className={l.vis ? 'on' : ''} style={{ padding: '1px 5px' }} onClick={e => { e.stopPropagation(); upd(l.id, c => { c.vis = !c.vis }) }} aria-label="Toggle visibility">●</button>
              <span style={{ width: 10, height: 10, background: l.color, borderRadius: 2 }} />
              <span>{l.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
