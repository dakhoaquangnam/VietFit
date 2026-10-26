// Read an exercise's description and steps aloud, in Vietnamese.
//
// Engine: Piper in the browser (@mintplex-labs/piper-tts-web), voice
// vi_VN-vais1000-medium. The model (~60 MB) downloads once, on first use, and
// is kept in the browser's Origin Private File System, so later reads work
// offline. Sound plays through a plain <audio> element, which keeps playing
// when the phone locks — speechSynthesis would stop there, so it is only the
// fallback when Piper cannot run (its device voice reads the same chunks).
//
// Before chunking, each text goes through lib/vi-tts-text.js, which turns
// digits, dates, times and units into speakable Vietnamese words ("12kg" ->
// "mười hai ki-lô-gam"). The voice and engine are untouched; the processed
// text is still plain Vietnamese, phonemized as usual.
//
// Text is split into chunks (one per description / step, cut at sentence
// boundaries when too long) so a long instruction reads step by step and a
// failure loses one chunk, not the whole text.

import { processVietnameseText } from './vi-tts-text.js'

export const PIPER_VOICE_ID = 'vi_VN-vais1000-medium'
export const MAX_CHUNK_CHARS = 500

/** Split text into chunks of at most `max` chars, cut at sentence ends. */
export function splitText(text, max = MAX_CHUNK_CHARS) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const chunks = []
  let cur = ''
  const flush = () => { if (cur) { chunks.push(cur); cur = '' } }
  const pushLong = piece => {
    let rest = piece
    while (rest.length > max) {
      const comma = Math.max(rest.lastIndexOf(', ', max), rest.lastIndexOf('; ', max))
      let cut = comma > max * 0.4 ? comma + 1 : -1
      if (cut < 0) {
        const space = rest.lastIndexOf(' ', max)
        cut = space > max * 0.4 ? space + 1 : max
      }
      chunks.push(rest.slice(0, cut).trim())
      rest = rest.slice(cut).trim()
    }
    if (rest) {
      if (cur && cur.length + 1 + rest.length > max) flush()
      cur = cur ? cur + ' ' + rest : rest
    }
  }
  for (const s of clean.split(/(?<=[.!?…])\s+/).filter(Boolean)) {
    if (s.length > max) { flush(); pushLong(s); continue }
    if (cur && cur.length + 1 + s.length > max) flush()
    cur = cur ? cur + ' ' + s : s
  }
  flush()
  return chunks
}

/** The chunks one exercise reads as: its description, then one per step.
 *  Numbers and units are spoken as Vietnamese words (see vi-tts-text.js),
 *  and processing happens before chunking so the cap counts spoken length. */
export function readChunks(desc, steps) {
  const out = []
  if (desc) out.push(...splitText(processVietnameseText(desc)))
  for (const s of steps || []) out.push(...splitText(processVietnameseText(s)))
  return out
}

// A minimal silent WAV, played once inside the tap that starts a read: iOS
// only lets an <audio> element play after a user gesture, and the first chunk
// is generated seconds after that tap, so the element is blessed here, up
// front, while the gesture is still live.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

/**
 * Plays chunks, Piper first, the device voice as fallback. Status updates go
 * to `onUpdate` as { status, engine, progress, index, total }:
 * idle | downloading | generating | playing | paused | error.
 */
export class TtsReader {
  constructor(onUpdate) {
    this.onUpdate = onUpdate
    this.state = { status: 'idle', engine: 'piper', progress: null, index: 0, total: 0 }
    this.audio = null
    this.chunks = []
    this.stopped = true
    this.session = null
  }

  set(patch) {
    this.state = { ...this.state, ...patch }
    this.onUpdate?.(this.state)
  }

  /** Bless the audio element inside the tap gesture (see SILENT_WAV). */
  unlock() {
    try {
      this.audio = new Audio()
      this.audio.preload = 'auto'
      this.audio.src = SILENT_WAV
      const p = this.audio.play()
      p?.catch(() => {})
    } catch { /* a later play() still tries */ }
  }

  async play(chunks) {
    this.stop()
    this.chunks = chunks
    this.stopped = false
    this.set({ status: 'generating', engine: 'piper', progress: null, index: 0, total: chunks.length })
    try {
      await this.playPiper(chunks)
    } catch {
      if (this.stopped) return
      try {
        await this.playDevice(chunks)
      } catch {
        if (!this.stopped) this.set({ status: 'error' })
      }
    }
  }

  async playPiper(chunks) {
    const tts = await import('@mintplex-labs/piper-tts-web')
    const stored = await tts.stored().catch(() => [])
    if (!stored.includes(PIPER_VOICE_ID)) {
      this.set({ status: 'downloading', progress: 0 })
      const totals = new Map()
      await tts.download(PIPER_VOICE_ID, p => {
        if (p.total > 0) {
          totals.set(p.url, { loaded: p.loaded, total: p.total })
          let loaded = 0, total = 0
          for (const v of totals.values()) { loaded += v.loaded; total += v.total }
          this.set({ progress: total ? Math.round(loaded / total * 100) : null })
        }
      })
    }
    if (this.stopped) return
    this.session = await tts.TtsSession.create({ voiceId: PIPER_VOICE_ID })
    if (!this.audio) { this.audio = new Audio(); this.audio.preload = 'auto' }
    for (let i = 0; i < chunks.length && !this.stopped; i++) {
      this.set({ status: 'generating', index: i })
      const blob = await this.session.predict(chunks[i])
      if (this.stopped) return
      const url = URL.createObjectURL(blob)
      this.set({ status: 'playing', index: i })
      await this.playUrl(url)
      URL.revokeObjectURL(url)
    }
    if (!this.stopped) this.set({ status: 'idle', index: 0 })
  }

  playUrl(url) {
    return new Promise(resolve => {
      const a = this.audio
      a.src = url
      a.onended = () => resolve()
      a.onerror = () => resolve()
      const p = a.play()
      p?.catch(() => resolve())
    })
  }

  async playDevice(chunks) {
    if (!('speechSynthesis' in window)) throw new Error('no speechSynthesis')
    const voices = speechSynthesis.getVoices()
    const voice = voices.find(v => (v.lang || '').toLowerCase().startsWith('vi')) || null
    this.set({ status: 'playing', engine: 'device' })
    for (let i = 0; i < chunks.length && !this.stopped; i++) {
      this.set({ index: i })
      await new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(chunks[i])
        if (voice) u.voice = voice
        u.lang = 'vi-VN'
        u.onend = resolve
        u.onerror = resolve
        speechSynthesis.speak(u)
      })
    }
    if (!this.stopped) this.set({ status: 'idle', index: 0 })
  }

  pause() {
    if (this.state.status !== 'playing') return
    if (this.state.engine === 'device') speechSynthesis.pause()
    else this.audio?.pause()
    this.set({ status: 'paused' })
  }

  resume() {
    if (this.state.status !== 'paused') return
    if (this.state.engine === 'device') speechSynthesis.resume()
    else {
      const p = this.audio?.play()
      p?.catch(() => {})
    }
    this.set({ status: 'playing' })
  }

  stop() {
    this.stopped = true
    this.session = null
    if (this.audio) { try { this.audio.pause() } catch {} this.audio.src = '' }
    try { speechSynthesis.cancel() } catch {}
    if (this.state.status !== 'idle') this.set({ status: 'idle', progress: null, index: 0 })
  }
}
