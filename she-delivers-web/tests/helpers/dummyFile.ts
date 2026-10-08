import type { Payload } from 'payload'
import sharp from 'sharp'

// A real (if minimal) 1x1 transparent PNG — Payload sniffs actual file
// bytes to verify the mimetype, so a fake buffer with a spoofed mimetype
// string is rejected. Generated with sharp rather than a hand-typed base64
// literal, for reliability.
export async function dummyPngBuffer() {
  return sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer()
}

export async function uploadDummyFile(payload: Payload, data: Record<string, unknown> = {}) {
  const pngBuffer = await dummyPngBuffer()
  return payload.create({
    collection: 'files',
    data,
    file: { data: pngBuffer, mimetype: 'image/png', name: `test-${Date.now()}-${Math.random()}.png`, size: pngBuffer.length },
    overrideAccess: true,
  })
}

export async function uploadDummyMedia(
  payload: Payload,
  data: { cohort: number; visibilityScope: 'admin-only' | 'cohort-extended' },
) {
  const pngBuffer = await dummyPngBuffer()
  return payload.create({
    collection: 'media',
    data,
    file: { data: pngBuffer, mimetype: 'image/png', name: `test-${Date.now()}-${Math.random()}.png`, size: pngBuffer.length },
    overrideAccess: true,
  })
}
