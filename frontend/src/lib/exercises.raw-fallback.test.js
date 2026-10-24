import { describe, expect, it } from 'vitest'
import { rawFallbackSrc } from './exercises.js'

// jsDelivr refuses a new file from a repository over its 50 MB package limit (VietFit is over
// 300 MB), so a still that answers 403 there gets one second chance straight from GitHub.
describe('rawFallbackSrc', () => {
  it('rewrites a jsDelivr GitHub URL to raw.githubusercontent.com', () => {
    expect(rawFallbackSrc('https://cdn.jsdelivr.net/gh/dakhoaquangnam/VietFit@dc4b8df/catalogue/media/still/1377.webp'))
      .toBe('https://raw.githubusercontent.com/dakhoaquangnam/VietFit/dc4b8df/catalogue/media/still/1377.webp')
  })

  it('leaves a local mount or another CDN alone', () => {
    expect(rawFallbackSrc('exercise-media/still/1377.webp')).toBeNull()
    expect(rawFallbackSrc('https://opengym.ch/demo/exercise-media/still/1377.webp')).toBeNull()
    expect(rawFallbackSrc(null)).toBeNull()
  })
})
