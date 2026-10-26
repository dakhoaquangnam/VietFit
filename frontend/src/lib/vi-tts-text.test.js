// vi-tts-text: Vietnamese number / unit / date reading for read-aloud.
// Pure text transformation, so it is fully testable here (the Piper voice
// itself still needs a browser + model and is verified live, not here).
import { describe, expect, it } from 'vitest'
import { numberToWords, processVietnameseText } from './vi-tts-text.js'

describe('numberToWords', () => {
  it('reads single digits and teens', () => {
    expect(numberToWords('0')).toBe('không')
    expect(numberToWords('5')).toBe('năm')
    expect(numberToWords('11')).toBe('mười một')
    expect(numberToWords('15')).toBe('mười lăm')
  })

  it('uses mốt / tư / lăm after tens', () => {
    expect(numberToWords('21')).toBe('hai mươi mốt')
    expect(numberToWords('24')).toBe('hai mươi tư')
    expect(numberToWords('25')).toBe('hai mươi lăm')
    expect(numberToWords('99')).toBe('chín mươi chín')
  })

  it('reads hundreds with lẻ and không trăm', () => {
    expect(numberToWords('101')).toBe('một trăm lẻ một')
    expect(numberToWords('110')).toBe('một trăm mười')
    expect(numberToWords('1001')).toBe('một nghìn không trăm lẻ một')
    expect(numberToWords('1010')).toBe('một nghìn không trăm mười')
    expect(numberToWords('1100')).toBe('một nghìn một trăm')
    expect(numberToWords('2026')).toBe('hai nghìn không trăm hai mươi sáu')
    expect(numberToWords('1000000')).toBe('một triệu')
  })
})

describe('processVietnameseText', () => {
  it('reads weights and hold times in instructions', () => {
    expect(processVietnameseText('Nâng tạ 12kg, giữ 30 giây.'))
      .toBe('Nâng tạ mười hai ki-lô-gam, giữ ba mươi giây.')
    expect(processVietnameseText('Nghỉ 60s rồi đổi bên.'))
      .toBe('Nghỉ sáu mươi giây rồi đổi bên.')
  })

  it('reads sets, reps and ranges', () => {
    expect(processVietnameseText('Thực hiện 3 hiệp, mỗi hiệp 12 lần.'))
      .toBe('Thực hiện ba hiệp, mỗi hiệp mười hai lần.')
    expect(processVietnameseText('Tăng dần từ 3-5kg.'))
      .toBe('Tăng dần từ ba đến năm ki-lô-gam.')
  })

  it('reads decimals, percentages and thousand separators', () => {
    expect(processVietnameseText('Dùng tạ 2,5kg.')).toBe('Dùng tạ hai phẩy năm ki-lô-gam.')
    expect(processVietnameseText('Hoàn thành 50% buổi tập.')).toBe('Hoàn thành năm mươi phần trăm buổi tập.')
    expect(processVietnameseText('Lặp lại 1.000 lần.')).toBe('Lặp lại một nghìn lần.')
  })

  it('reads dates, times and ordinals', () => {
    expect(processVietnameseText('Bắt đầu từ 25/10/2026.'))
      .toBe('Bắt đầu từ ngày hai mươi lăm tháng mười năm hai nghìn không trăm hai mươi sáu.')
    expect(processVietnameseText('Tập lúc 10:30.')).toBe('Tập lúc mười giờ ba mươi phút.')
    expect(processVietnameseText('Bước thứ 1: đứng thẳng.')).toBe('Bước thứ nhất: đứng thẳng.')
  })

  it('leaves plain text alone', () => {
    expect(processVietnameseText('Đứng thẳng, hai chân rộng bằng vai.'))
      .toBe('Đứng thẳng, hai chân rộng bằng vai.')
    expect(processVietnameseText('')).toBe('')
  })

  it('does not mistake letters inside words for units', () => {
    expect(processVietnameseText('Làm 12 lần, mỗi lần giữ 3 giây.'))
      .toBe('Làm mười hai lần, mỗi lần giữ ba giây.')
    expect(processVietnameseText('Đứng cách tường 12m.'))
      .toBe('Đứng cách tường mười hai mét.')
  })
})
