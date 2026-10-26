// Vietnamese text normalisation for the read-aloud feature.
//
// Turns digits, dates, times and units into speakable Vietnamese words
// BEFORE the text reaches the Piper voice, so "12kg" is read as
// "mười hai ki-lô-gam" instead of however the phonemizer guesses digits.
// English gym terms left untranslated in the packs ("squat", "core",
// "Smith", ...) are replaced with Vietnamese readings the same way.
// The voice, the engine and the phonemizer are untouched: this output is
// still plain Vietnamese text, which piper-tts-web phonemizes as usual.
//
// Pure functions, no dependencies. Written from the standard rules for
// reading Vietnamese numbers (mốt / tư / lăm, lẻ, không trăm, ...), kept
// to what exercise descriptions and steps actually contain: numbers,
// decimals, percentages, ranges, dates, times and metric/time units.
// Currency, phone numbers and Roman numerals are deliberately out of scope.

const DIGITS = {
  0: 'không', 1: 'một', 2: 'hai', 3: 'ba', 4: 'bốn',
  5: 'năm', 6: 'sáu', 7: 'bảy', 8: 'tám', 9: 'chín'
}

const TEENS = {
  10: 'mười', 11: 'mười một', 12: 'mười hai', 13: 'mười ba',
  14: 'mười bốn', 15: 'mười lăm', 16: 'mười sáu', 17: 'mười bảy',
  18: 'mười tám', 19: 'mười chín'
}

const TENS = {
  2: 'hai mươi', 3: 'ba mươi', 4: 'bốn mươi', 5: 'năm mươi',
  6: 'sáu mươi', 7: 'bảy mươi', 8: 'tám mươi', 9: 'chín mươi'
}

/** Read 0..99 with the usual unit variants after tens. */
function readUnder100(n) {
  if (n < 10) return DIGITS[n]
  if (n < 20) return TEENS[n]
  const tens = Math.floor(n / 10)
  const units = n % 10
  if (units === 0) return TENS[tens]
  if (units === 1) return TENS[tens] + ' mốt'
  if (units === 4) return TENS[tens] + ' tư'
  if (units === 5) return TENS[tens] + ' lăm'
  return TENS[tens] + ' ' + DIGITS[units]
}

/** Read 0..999, with "lẻ" for a zero tens digit. */
function readUnder1000(n) {
  if (n < 100) return readUnder100(n)
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  let out = DIGITS[hundreds] + ' trăm'
  if (rest === 0) return out
  if (rest < 10) return out + ' lẻ ' + DIGITS[rest]
  return out + ' ' + readUnder100(rest)
}

/** Read an integer 0..999,999,999,999. Larger values fall back to digits. */
export function numberToWords(numStr) {
  const clean = String(numStr).replace(/^0+/, '') || '0'
  if (clean.startsWith('-')) return 'âm ' + numberToWords(clean.slice(1))
  const n = Number(clean)
  if (!Number.isSafeInteger(n) || n < 0) return clean.split('').map(d => DIGITS[d] || d).join(' ')
  if (n === 0) return 'không'
  if (n < 1000) return readUnder1000(n)
  if (n < 1000000) {
    const high = Math.floor(n / 1000)
    const rest = n % 1000
    let out = readUnder1000(high) + ' nghìn'
    if (rest === 0) return out
    if (rest < 10) return out + ' không trăm lẻ ' + DIGITS[rest]
    if (rest < 100) return out + ' không trăm ' + readUnder100(rest)
    return out + ' ' + readUnder1000(rest)
  }
  const scale = n < 1000000000 ? [1000000, 'triệu'] : [1000000000, 'tỷ']
  const high = Math.floor(n / scale[0])
  const rest = n % scale[0]
  let out = numberToWords(String(high)) + ' ' + scale[1]
  if (rest === 0) return out
  if (rest < 10) return out + ' lẻ ' + DIGITS[rest]
  if (rest < 100) return out + ' lẻ ' + readUnder100(rest)
  if (rest < 1000) return out + ' không nghìn ' + readUnder1000(rest)
  return out + ' ' + numberToWords(String(rest))
}

// English gym terms left untranslated in the exercise packs, read as
// Vietnamese approximations so Piper does not guess their pronunciation.
// Whole words only: "bar" in "barbell" is left alone.
const TRANSLITERATIONS = {
  achilles: 'a-sin', bar: 'ba', bosu: 'bô-xu', bowling: 'bâu-linh',
  boxing: 'bốc-xinh', burpee: 'bơ-pi', cardio: 'các-đi-ô',
  chaturanga: 'cha-tu-răng-ga', clean: 'cờ-lin', core: 'co',
  crusher: 'cờ-rớt-sơ', curtsey: 'cớt-xì', deadlift: 'đét-líp',
  elliptical: 'e-líp-ti-cồ', ez: 'ê-dét', front: 'frơn',
  ghd: 'gê-hát-đê', goblet: 'gốp-lét', hack: 'hắc', landmine: 'len-mai',
  olympic: 'ô-lim-pích', pike: 'pai', planche: 'plăng', plank: 'plăng',
  preacher: 'prít-chơ', pvc: 'pê-vê-xê', rack: 'rắc',
  reformer: 'rê-pho-mơ', setup: 'sét-ấp', skull: 's-cồ',
  smith: 'sờ-mít', snatch: 'sờ-nách', squat: 'sờ-quát',
  sz: 'ét-dét', tail: 'têu', tennis: 'ten-nít', tiger: 'tai-gơ',
  trap: 'tráp', yoke: 'dôk'
}

const TRANSLITERATION_PATTERN = new RegExp(
  `(^|[^\\p{L}])(${Object.keys(TRANSLITERATIONS).sort((a, b) => b.length - a.length).join('|')})(?=[^\\p{L}]|$)`, 'giu')

const ROMAN_NUMERALS = { I: 'một', II: 'hai', III: 'ba' }

/** Replace English gym terms (and yoga numerals I/II/III) with readings. */
function transliterate(text) {
  return text
    .replace(TRANSLITERATION_PATTERN, (_, before, word) => before + TRANSLITERATIONS[word.toLowerCase()])
    .replace(/(^|[^\p{L}])(III|II|I)(?=[^\p{L}]|$)/gu, (_, before, numeral) => before + ROMAN_NUMERALS[numeral])
}

/** Read a decimal fraction: as a number, or digit by digit after a zero. */
function decimalWords(frac) {
  if (/^0/.test(frac)) return frac.split('').map(d => DIGITS[d] || d).join(' ')
  return numberToWords(frac)
}

const UNIT_NAMES = {
  'km/h': 'ki-lô-mét trên giờ', km: 'ki-lô-mét', cm: 'xăng-ti-mét',
  mm: 'mi-li-mét', mg: 'mi-li-gam', ml: 'mi-li-lít', kg: 'ki-lô-gam',
  'cm²': 'xăng-ti-mét vuông', 'km²': 'ki-lô-mét vuông', 'm²': 'mét vuông',
  'cm3': 'xăng-ti-mét khối', 'm3': 'mét khối',
  sec: 'giây', min: 'phút', hrs: 'giờ', hr: 'giờ',
  m: 'mét', g: 'gam', l: 'lít', s: 'giây', h: 'giờ'
}

// Longest first, so "cm" wins over "m" and "mg" over "g".
const UNITS = Object.keys(UNIT_NAMES).sort((a, b) => b.length - a.length)

/** "12kg" / "12 kg" -> "12 ki-lô-gam"; digits stay digits for later steps. */
function convertUnits(text) {
  for (const unit of UNITS) {
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = unit.length === 1
      ? `(\\d+)\\s*${escaped}(?![a-zà-ỹ])`
      : `(\\d+)\\s*${escaped}(?=\\s|[^\\w]|$)`
    text = text.replace(new RegExp(pattern, 'gi'), (_, digits) => digits + ' ' + UNIT_NAMES[unit])
  }
  return text
}

/**
 * Main entry: raw Vietnamese text -> speakable Vietnamese text.
 * Digits that reach the end are read as words by convertStandaloneNumbers,
 * so earlier steps may leave digits in place (dates, times, ranges).
 */
export function processVietnameseText(text) {
  if (!text || typeof text !== 'string') return ''
  text = text.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  // English gym terms first: their readings contain no digits or units,
  // so later steps leave them alone.
  text = transliterate(text)

  // Thousand separators: "1.000" -> "1000" (dots, Vietnamese style).
  text = text.replace(/(\d{1,3}(?:\.\d{3})+)(?=\s|$|[^\d.,])/g, (_, num) => num.replace(/\./g, ''))

  // Ordinal "thứ 1" is "thứ nhất", not "thứ một"; the rest read naturally.
  text = text.replace(/thứ\s+1(?!\d)/gi, 'thứ nhất')

  // Dates, both separators: "25/10/2026" / "25-10-2026".
  text = text.replace(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/g, 'ngày $1 tháng $2 năm $3')

  // Times: "10:30" -> "10 giờ 30 phút".
  text = text.replace(/(\d{1,2}):(\d{2})/g, '$1 giờ $2 phút')

  // Ranges: "3-5kg" -> "3 đến 5 kg" (units and numbers handled later).
  text = text.replace(/(\d+)\s*[-–—]\s*(\d+)/g, '$1 đến $2')

  // Units attached to digits, before decimals so "2,5kg" works.
  text = convertUnits(text)

  // Percentages, decimal-aware: "50%" / "3,2%".
  text = text.replace(/(\d+)(?:,(\d+))?\s*%/g, (_, int, frac) =>
    frac === undefined ? numberToWords(int) + ' phần trăm'
      : numberToWords(int) + ' phẩy ' + decimalWords(frac) + ' phần trăm')

  // Decimals: comma (Vietnamese) or dot with 1-2 digits after it.
  text = text.replace(/(\d+),(\d+)(?=\s|$|[^\d,])/g, (_, int, frac) =>
    numberToWords(int) + ' phẩy ' + decimalWords(frac))
  text = text.replace(/(\d+)\.(\d{1,2})(?!\d)/g, (_, int, frac) =>
    numberToWords(int) + ' phẩy ' + decimalWords(frac))

  // Whatever digits remain are standalone numbers.
  text = text.replace(/\d+/g, match => numberToWords(match))

  return text.replace(/\s+/g, ' ').trim()
}
