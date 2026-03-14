#!/usr/bin/env node
// Run: node scripts/generate-icons.js
// Generates all required PWA icon sizes as PNG files

const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const OUT_DIR = path.join(__dirname, '../public/icons')

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#2563eb'
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.22)
  ctx.fill()

  // Chart bars (simplified)
  const barW = size * 0.1
  const barGap = size * 0.06
  const baseY = size * 0.72
  const bars = [0.35, 0.55, 0.42, 0.68, 0.85]
  const totalW = bars.length * barW + (bars.length - 1) * barGap
  let x = (size - totalW) / 2

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  bars.forEach((h, i) => {
    const barH = size * h * 0.45
    ctx.beginPath()
    ctx.roundRect(x, baseY - barH, barW, barH, 2)
    ctx.fill()
    x += barW + barGap
  })

  // Last bar highlight
  ctx.fillStyle = '#ffffff'
  const lastH = size * 0.85 * 0.45
  const lastX = (size - totalW) / 2 + 4 * (barW + barGap)
  ctx.beginPath()
  ctx.roundRect(lastX, baseY - lastH, barW, lastH, 2)
  ctx.fill()

  // "₩" symbol
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.22}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('₩', size / 2, size * 0.28)

  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), buffer)
  console.log(`✓ icon-${size}.png`)
}

SIZES.forEach(generateIcon)
console.log('\n✅ All icons generated in public/icons/')
