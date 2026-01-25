const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const sizes = [192, 512]
const svgPath = path.join(__dirname, '../public/icons/icon.svg')
const outputDir = path.join(__dirname, '../public/icons')

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath)

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    console.log(`Generated: icon-${size}.png`)
  }

  console.log('Done!')
}

generateIcons().catch(console.error)
