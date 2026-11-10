// Read an exercise's description and steps aloud, in Vietnamese.
//
// Engine: VieNeu TTS Lite, a small ONNX voice service (v3 Nano, voice
// "Trúc Ly"), reached over the network — no model downloads onto the phone,
// no on-device inference. The reader's own API key lives in secure storage
// (lib/coach-secrets.js, key 'vieneu.apiKey') and is sent as a Bearer token;
// without it nothing is read. Sound plays through a plain <audio> element,
// which keeps playing when the phone locks — speechSynthesis would stop
// there, so it is only the fallback when VieNeu cannot be reached (its
// device voice reads the same chunks, and the note says so).
//
// Before chunking, each text goes through lib/vi-tts-text.js, which turns
// digits, dates, times and units into speakable Vietnamese words ("12kg" ->
// "mười hai ki-lô-gam"). English gym terms are left as they are: VieNeu
// reads English in the original, and the Piper-era phonetic readings would
// make it mispronounce them, so readChunks asks for skipTransliteration.
//
// Text is split into chunks (one per description / step, cut at sentence
// boundaries when too long) so a long instruction reads step by step and a
// failure loses one chunk, not the whole text.

import { processVietnameseText } from './vi-tts-text.js'
import { secureGet, VIENEU_API_KEY } from './coach-secrets.js'

export const VIENEU_BASE = 'https://8000-agq4avcnnsnmokkqxrqgd55qke.instabox.tech'
export const VIENEU_VOICE = 'Trúc Ly'
export const VIENEU_MODEL = 'vieneu-v3-nano'
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
 *  and processing happens before chunking so the cap counts spoken length.
 *  English gym terms stay in the original: VieNeu reads them as English,
 *  so the transliteration table (written for Piper) is skipped. */
export function readChunks(desc, steps) {
  const out = []
  if (desc) out.push(...splitText(processVietnameseText(desc, { skipTransliteration: true })))
  for (const s of steps || []) out.push(...splitText(processVietnameseText(s, { skipTransliteration: true })))
  return out
}

// A minimal silent WAV, played once inside the tap that starts a read: iOS
// only lets an <audio> element play after a user gesture, and the first chunk
// is generated seconds after that tap, so the element is blessed here, up
// front, while the gesture is still live.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

/** One chunk of audio from the VieNeu voice service. Throws an Error with
 *  .status set on an HTTP failure (401: the stored key is wrong). */
export async function fetchSpeech(text, key, timeoutMs = 25000) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const resp = await fetch(`${VIENEU_BASE}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: VIENEU_MODEL, voice: VIENEU_VOICE, input: text, response_format: 'wav', sample_rate: 24000 }),
      signal: ctl.signal,
    })
    if (!resp.ok) { const e = new Error('HTTP ' + resp.status); e.status = resp.status; throw e }
    return await resp.blob()
  } finally { clearTimeout(timer) }
}

// Notes are plain Vietnamese, not t() strings: the Listen button only ever
// renders when the app is in Vietnamese (sheets.jsx), so the reader's
// messages are always shown in that language.
const NOTE_NO_KEY = 'Chưa có key VieNeu — thêm key trong Cài đặt'
const NOTE_BAD_KEY = 'Key VieNeu không đúng — kiểm tra lại trong Cài đặt'
const NOTE_WAKING = 'Máy đọc đang tỉnh dậy, đợi một lát nhé...'
const noteFallback = err => `(VieNeu lỗi: ${err} — đọc bằng giọng máy)`

/**
 * Plays chunks, VieNeu first, the device voice as fallback. Status updates go
 * to `onUpdate` as { status, engine, progress, index, total, note }:
 * idle | generating | playing | paused | error. `note` is the line shown
 * under the button: empty while VieNeu reads, the waking line while the
 * reader is retried, the real error on a wrong key or a device-voice
 * fallback. A 401 never falls back — a wrong key read aloud in the device
 * voice would hide the mistake.
 */
export class TtsReader {
  constructor(onUpdate) {
    this.onUpdate = onUpdate
    this.state = { status: 'idle', engine: 'vieneu', progress: null, index: 0, total: 0, note: '' }
    this.audio = null
    this.chunks = []
    this.stopped = true
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

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async play(chunks) {
    this.stop()
    this.chunks = chunks
    this.stopped = false
    this.set({ status: 'generating', engine: 'vieneu', progress: null, index: 0, total: chunks.length, note: '' })
    const key = await secureGet(VIENEU_API_KEY).catch(() => null)
    if (this.stopped) return
    if (!key) {
      this.set({ status: 'error', note: NOTE_NO_KEY })
      return
    }
    try {
      await this.playVieneu(chunks, key)
    } catch (e) {
      if (this.stopped) return
      if (e && e.status === 401) {
        this.set({ status: 'error', note: NOTE_BAD_KEY })
        return
      }
      // Anything else (the reader asleep, the network down): the device
      // voice reads instead, and the note says what really happened.
      const msg = (e && e.message) ? e.message : String(e)
      this.set({ note: noteFallback(msg) })
      try {
        await this.playDevice(chunks)
      } catch {
        if (!this.stopped) this.set({ status: 'error' })
      }
    }
  }

  async playVieneu(chunks, key) {
    if (!this.audio) { this.audio = new Audio(); this.audio.preload = 'auto' }
    for (let i = 0; i < chunks.length && !this.stopped; i++) {
      this.set({ status: 'generating', index: i })
      let blob
      try {
        blob = await fetchSpeech(chunks[i], key, 25000)
      } catch (e) {
        if (e && e.status === 401) throw e
        // The reader may be asleep: say so, wait, try once more.
        this.set({ note: NOTE_WAKING })
        await this.wait(6000)
        if (this.stopped) return
        blob = await fetchSpeech(chunks[i], key, 60000)
        this.set({ note: '' })
      }
      if (this.stopped) return
      const url = URL.createObjectURL(blob)
      this.set({ status: 'playing', index: i })
      await this.playUrl(url)
      URL.revokeObjectURL(url)
    }
    if (!this.stopped) this.set({ status: 'idle', index: 0, note: '' })
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
    if (!this.stopped) this.set({ status: 'idle', index: 0, note: '' })
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
    if (this.audio) { try { this.audio.pause() } catch {} this.audio.src = '' }
    try { speechSynthesis.cancel() } catch {}
    if (this.state.status !== 'idle') this.set({ status: 'idle', progress: null, index: 0, note: '' })
  }
}
