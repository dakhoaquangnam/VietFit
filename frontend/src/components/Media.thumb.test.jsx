// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// A still that will not load (offline and never cached, a lapsed session on a gated instance)
// gets the neutral tile an exercise without media has, not the browser's broken-image glyph (#281).
vi.mock('../store/useStore.js', () => ({ useStore: () => null }))
const { Thumb } = await import('./Media.jsx')

const mounted = []
function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  act(() => root.render(el))
  return { host, root }
}
afterEach(() => { act(() => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }) })

describe('Thumb', () => {
  it('shows the still, and the neutral tile once it fails to load', () => {
    const { host } = mount(<Thumb ex={{ id: 'a', img: 'a.jpg' }} />)
    const img = host.querySelector('img.thumb')
    expect(img.getAttribute('src')).toMatch(/a\.jpg$/)
    act(() => { img.dispatchEvent(new Event('error')) })
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('.thumb.thumb-x')).toBeTruthy()
  })

  it('another exercise in the same place tries its own still', () => {
    const { host, root } = mount(<Thumb ex={{ id: 'a', img: 'a.jpg' }} />)
    act(() => { host.querySelector('img').dispatchEvent(new Event('error')) })
    act(() => root.render(<Thumb ex={{ id: 'b', img: 'b.jpg' }} />))
    expect(host.querySelector('img.thumb').getAttribute('src')).toMatch(/b\.jpg$/)
  })

  it('an exercise without media has the tile from the start', () => {
    const { host } = mount(<Thumb ex={{ id: 'c' }} />)
    expect(host.querySelector('.thumb-x')).toBeTruthy()
  })

  it('a jsDelivr still that fails tries raw GitHub before the tile', async () => {
    vi.stubEnv('VITE_IMG_BASE', 'https://cdn.jsdelivr.net/gh/dakhoaquangnam/VietFit@dc4b8df/catalogue/media/still/')
    vi.resetModules()
    const { Thumb: FreshThumb } = await import('./Media.jsx')
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    mounted.push({ root, host })
    act(() => root.render(<FreshThumb ex={{ id: 'x', img: '1377.webp' }} />))
    const img = host.querySelector('img.thumb')
    expect(img.getAttribute('src')).toMatch(/cdn\.jsdelivr\.net.*1377\.webp$/)
    act(() => { img.dispatchEvent(new Event('error')) })
    expect(host.querySelector('img.thumb').getAttribute('src'))
      .toBe('https://raw.githubusercontent.com/dakhoaquangnam/VietFit/dc4b8df/catalogue/media/still/1377.webp')
    act(() => { host.querySelector('img.thumb').dispatchEvent(new Event('error')) })
    expect(host.querySelector('img')).toBeNull()
    expect(host.querySelector('.thumb.thumb-x')).toBeTruthy()
    vi.unstubAllEnvs()
    vi.resetModules()
  })
})
