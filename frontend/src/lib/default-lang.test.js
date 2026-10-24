// @vitest-environment happy-dom
// #303: an instance-wide default language, and the browser's, apply only to a copy nobody has
// picked a language for — never to an existing profile, whose `lang: 'en'` may be a choice.
import { describe, expect, it, beforeEach } from 'vitest'
import { matchLocale, autoLang, effectiveLang } from './default-lang.js'

describe('matchLocale', () => {
  it('matches the full tag first, in any case or separator', () => {
    expect(matchLocale('pt-BR')).toBe('pt-BR')
    expect(matchLocale('pt_br')).toBe('pt-BR')
    expect(matchLocale(' DE-ch ')).toBe('de-CH')
  })
  it('falls back to the base language, and to nothing for one the app does not have', () => {
    expect(matchLocale('de-AT')).toBe('de')
    expect(matchLocale('en-US')).toBe('en')
    expect(matchLocale('pt')).toBe('pt')
    expect(matchLocale('nl-NL')).toBe(null)
    expect(matchLocale('')).toBe(null)
    expect(matchLocale(undefined)).toBe(null)
  })
  it('reads the Traditional Chinese tags as zh-TW and the rest of Chinese as zh', () => {
    expect(matchLocale('zh-TW')).toBe('zh-TW')
    expect(matchLocale('zh-Hant')).toBe('zh-TW')
    expect(matchLocale('zh-Hant-TW')).toBe('zh-TW')
    expect(matchLocale('zh-HK')).toBe('zh-TW')
    expect(matchLocale('zh-MO')).toBe('zh-TW')
    expect(matchLocale('zh-CN')).toBe('zh')
    expect(matchLocale('zh-Hans-CN')).toBe('zh')
    expect(matchLocale('zh')).toBe('zh')
  })
})

describe('autoLang', () => {
  const fresh = { lang: 'en', langAuto: true }
  it('leaves a copy alone that chose, or that predates the mark', () => {
    expect(autoLang({ lang: 'en' }, { default_lang: 'pt-BR' }, ['de-DE'])).toBe(null)
    expect(autoLang({ lang: 'en', langAuto: false }, { default_lang: 'pt-BR' }, ['de-DE'])).toBe(null)
  })
  it('puts DEFAULT_LANG before the browser, the browser before English', () => {
    expect(autoLang(fresh, { default_lang: 'pt-BR' }, ['de-DE'])).toBe('pt-BR')
    expect(autoLang(fresh, {}, ['nl-NL', 'de-DE'])).toBe('de')
    expect(autoLang(fresh, {}, ['nl-NL'])).toBe('en')
    expect(autoLang(fresh, { default_lang: 'xx' }, ['fr-FR'])).toBe('fr')
  })
})

describe('effectiveLang', () => {
  const fresh = { lang: 'en', langAuto: true }
  beforeEach(() => { try { localStorage.clear() } catch { /* ignore */ } })
  it('uses the browser language when no config has ever been seen (serverless hosting)', () => {
    expect(effectiveLang(fresh, null, ['vi-VN'])).toBe('vi')
    expect(effectiveLang(fresh, null, ['nl-NL'])).toBe('en')
  })
  it('still prefers a cached instance default over the browser once one was seen', () => {
    try { localStorage.setItem('gym_default_lang', 'pt-BR') } catch { /* ignore */ }
    expect(effectiveLang(fresh, null, ['vi-VN'])).toBe('pt-BR')
  })
  it('leaves a copy alone that chose a language, even with no config', () => {
    expect(effectiveLang({ lang: 'vi' }, null, ['de-DE'])).toBe('vi')
    expect(effectiveLang({ lang: 'en', langAuto: false }, null, ['vi-VN'])).toBe('en')
  })
})
