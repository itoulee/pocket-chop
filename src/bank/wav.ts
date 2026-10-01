/** Encode AudioBuffer → 16-bit mono/stereo WAV ArrayBuffer. */

export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = Math.min(2, buffer.numberOfChannels) as 1 | 2
  const sampleRate = buffer.sampleRate
  const numFrames = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numFrames * blockAlign
  const headerSize = 44
  const ab = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(ab)
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, (s * 0x7fff) | 0, true)
      offset += 2
    }
  }
  return ab
}

export function cloneAudioBuffer(ctx: AudioContext, src: AudioBuffer): AudioBuffer {
  const dst = ctx.createBuffer(src.numberOfChannels, src.length, src.sampleRate)
  for (let c = 0; c < src.numberOfChannels; c++) {
    dst.copyToChannel(src.getChannelData(c), c)
  }
  return dst
}

export interface StoredSample {
  sampleRate: number
  channels: number
  length: number
  channelData: Float32Array[]
}

export function bufferToStored(buf: AudioBuffer): StoredSample {
  const channelData: Float32Array[] = []
  for (let c = 0; c < buf.numberOfChannels; c++) {
    channelData.push(new Float32Array(buf.getChannelData(c)))
  }
  return {
    sampleRate: buf.sampleRate,
    channels: buf.numberOfChannels,
    length: buf.length,
    channelData,
  }
}

export function storedToBuffer(ctx: BaseAudioContext, s: StoredSample): AudioBuffer {
  const buf = ctx.createBuffer(s.channels, s.length, s.sampleRate)
  for (let c = 0; c < s.channels; c++) {
    buf.copyToChannel(s.channelData[c], c)
  }
  return buf
}
