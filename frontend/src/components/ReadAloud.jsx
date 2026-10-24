// "Listen" button for an exercise's description and steps, read aloud in
// Vietnamese by Piper (see lib/tts-read.js), the device voice as fallback.
// Shown only where the caller already knows the text is Vietnamese.
import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { TtsReader, readChunks } from '../lib/tts-read.js'
import { useUI } from '../store/useUI.js'
import { Button } from './ui.jsx'

const toast = m => useUI.getState().toast(m)

export default function ReadAloud({ desc, steps }) {
  const [state, setState] = useState({ status: 'idle', engine: 'piper', progress: null, index: 0, total: 0 })
  const [reader] = useState(() => new TtsReader(setState))
  useEffect(() => () => reader.stop(), [reader])
  useEffect(() => {
    if (state.status === 'error') toast(t('Something went wrong'))
  }, [state.status])

  const chunks = readChunks(desc, steps)
  if (!chunks.length) return null

  const onTap = () => {
    if (state.status === 'playing') return reader.pause()
    if (state.status === 'paused') return reader.resume()
    if (state.status === 'downloading' || state.status === 'generating') return reader.stop()
    reader.unlock()
    reader.play(chunks)
  }

  const label = state.status === 'downloading'
    ? t('Downloading voice…') + (state.progress != null ? ` ${state.progress}%` : '')
    : state.status === 'generating' ? t('Generating voice…')
    : state.status === 'playing' ? t('Pause')
    : state.status === 'paused' ? t('Resume')
    : t('Listen to description and instructions')
  const icon = state.status === 'playing' ? 'pause'
    : state.status === 'paused' ? 'play'
    : state.status === 'downloading' ? 'download' : 'speaker'

  return <>
    <Button icon={icon} style={{ margin: '10px 0 4px' }} onClick={onTap}>{label}</Button>
    {(state.status === 'playing' || state.status === 'paused') && <>
      {state.total > 1 && <div className="small dim">{state.index + 1} / {state.total}</div>}
      {state.engine === 'device' && <div className="small dim">{t('Reading with device voice')}</div>}
    </>}
  </>
}
