// tts-read: chunking for the read-aloud feature (the Piper engine itself
// needs a browser + model, so it is verified live, not here).
import { describe, expect, it } from 'vitest'
import { splitText, readChunks, MAX_CHUNK_CHARS } from './tts-read.js'

describe('splitText', () => {
  it('returns nothing for empty text', () => {
    expect(splitText('')).toEqual([])
    expect(splitText('   ')).toEqual([])
  })

  it('keeps a short text whole', () => {
    expect(splitText('Đứng thẳng, hai chân rộng bằng vai.')).toEqual(['Đứng thẳng, hai chân rộng bằng vai.'])
  })

  it('packs sentences into chunks under the cap, losing nothing', () => {
    const text = 'Đứng thẳng, hai chân rộng bằng vai. Siết chặt cơ core. Từ từ hạ người xuống, giữ lưng thẳng. Đứng lên và lặp lại đủ số lần mong muốn.'
    const chunks = splitText(text, 60)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(c => c.length <= 60)).toBe(true)
    expect(chunks.join(' ')).toBe(text)
  })

  it('cuts a very long sentence without dropping words', () => {
    const words = Array.from({ length: 120 }, (_, i) => `từ${i}`)
    const text = words.join(' ') + '.'
    const chunks = splitText(text, 100)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(c => c.length <= 100)).toBe(true)
    expect(chunks.every(c => c.length > 0)).toBe(true)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text)
  })

  it('never emits a chunk over the default cap', () => {
    const text = Array.from({ length: 40 }, () => 'Một câu hướng dẫn khá dài, có nhiều mệnh đề, và tiếp tục thêm nữa.').join(' ')
    expect(splitText(text).every(c => c.length <= MAX_CHUNK_CHARS)).toBe(true)
  })
})

describe('readChunks', () => {
  it('reads the description first, then one chunk per step', () => {
    const chunks = readChunks('Mô tả ngắn.', ['Bước một.', 'Bước hai.'])
    expect(chunks).toEqual(['Mô tả ngắn.', 'Bước một.', 'Bước hai.'])
  })

  it('works with only steps, or with neither', () => {
    expect(readChunks('', ['Bước một.'])).toEqual(['Bước một.'])
    expect(readChunks('', [])).toEqual([])
    expect(readChunks(null, null)).toEqual([])
  })
})
