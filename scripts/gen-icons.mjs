import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const publicDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'public')

const BOLT_PATH =
  'M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z'
const BOLT_COLOR = '#863bff'
const DARK = { r: 13, g: 15, b: 20, alpha: 1 } // #0d0f14
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

function boltBuffer(px) {
  const h = Math.round((px * 46) / 48)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${h}" viewBox="0 0 48 46"><path d="${BOLT_PATH}" fill="${BOLT_COLOR}"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function makeIcon(file, size, content, background) {
  const bolt = await boltBuffer(content)
  const png = await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: bolt, gravity: 'center' }])
    .png()
    .toBuffer()
  await writeFile(path.join(publicDir, file), png)
  console.log('wrote', file, `${size}x${size}`)
}

await makeIcon('pwa-192x192.png', 192, 150, TRANSPARENT)
await makeIcon('pwa-512x512.png', 512, 400, TRANSPARENT)
await makeIcon('pwa-maskable-512x512.png', 512, 300, DARK)
await makeIcon('apple-touch-icon.png', 180, 120, DARK)
