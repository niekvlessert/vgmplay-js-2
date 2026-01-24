import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DIST_DIR = path.join(__dirname, '../../dist')
const OUTPUT_DIR = path.join(__dirname, '../public/dist')
const COVERS_DIR = path.join(OUTPUT_DIR, 'covers')
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json')

async function parseVGMTitle(buffer) {
  // VGM file header parsing for GD3 tag
  // Reference: https://vgmrips.net/wiki/VGM_Specification
  try {
    const view = new DataView(buffer.buffer)

    // Check VGM magic number "Vgm "
    const magic = String.fromCharCode(
      view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
    )
    if (magic !== 'Vgm ') return null

    // GD3 offset is at 0x14 (relative to 0x14)
    const gd3Offset = view.getUint32(0x14, true)
    if (gd3Offset === 0) return null

    const gd3Pos = 0x14 + gd3Offset

    // Check GD3 magic "Gd3 "
    const gd3Magic = String.fromCharCode(
      view.getUint8(gd3Pos), view.getUint8(gd3Pos + 1),
      view.getUint8(gd3Pos + 2), view.getUint8(gd3Pos + 3)
    )
    if (gd3Magic !== 'Gd3 ') return null

    // GD3 data starts at gd3Pos + 12
    let pos = gd3Pos + 12
    const strings = []

    // Read 11 null-terminated UTF-16LE strings
    for (let i = 0; i < 11 && pos < buffer.length - 1; i++) {
      let str = ''
      while (pos < buffer.length - 1) {
        const char = view.getUint16(pos, true)
        pos += 2
        if (char === 0) break
        str += String.fromCharCode(char)
      }
      strings.push(str)
    }

    return {
      trackNameEn: strings[0] || '',
      trackNameJp: strings[1] || '',
      gameNameEn: strings[2] || '',
      gameNameJp: strings[3] || '',
      systemNameEn: strings[4] || '',
      systemNameJp: strings[5] || '',
      authorNameEn: strings[6] || '',
      authorNameJp: strings[7] || '',
      releaseDate: strings[8] || '',
      vgmCreator: strings[9] || '',
      notes: strings[10] || ''
    }
  } catch (e) {
    return null
  }
}

async function processZipFile(zipPath, gameId) {
  const data = fs.readFileSync(zipPath)
  const zip = await JSZip.loadAsync(data)

  const tracks = []
  let gameInfo = null
  let coverImageData = null
  let coverImageExt = null

  for (const [filename, file] of Object.entries(zip.files)) {
    if (file.dir) continue

    const lowerName = filename.toLowerCase()

    // Get cover image (extract the actual image data)
    if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      coverImageData = await file.async('uint8array')
      coverImageExt = path.extname(filename).toLowerCase()
    }

    // Process VGM/VGZ files
    if (lowerName.endsWith('.vgm') || lowerName.endsWith('.vgz')) {
      let buffer = await file.async('uint8array')

      // If VGZ (gzip compressed), decompress
      if (lowerName.endsWith('.vgz') || (buffer[0] === 0x1f && buffer[1] === 0x8b)) {
        const pako = await import('pako')
        try {
          buffer = pako.default.inflate(buffer)
        } catch (e) {
          console.log(`  Skipping ${filename}: decompression failed`)
          continue
        }
      }

      const vgmInfo = await parseVGMTitle(buffer)

      tracks.push({
        filename,
        name: vgmInfo?.trackNameEn || vgmInfo?.trackNameJp || path.basename(filename, path.extname(filename)),
        nameJp: vgmInfo?.trackNameJp || ''
      })

      // Get game info from first track
      if (!gameInfo && vgmInfo) {
        gameInfo = {
          title: vgmInfo.gameNameEn || vgmInfo.gameNameJp || '',
          titleJp: vgmInfo.gameNameJp || '',
          system: vgmInfo.systemNameEn || vgmInfo.systemNameJp || '',
          author: vgmInfo.authorNameEn || vgmInfo.authorNameJp || ''
        }
      }
    }
  }

  // Save cover image if found
  let coverImagePath = null
  if (coverImageData && coverImageExt) {
    const coverFileName = `${gameId}${coverImageExt}`
    const coverFullPath = path.join(COVERS_DIR, coverFileName)
    fs.writeFileSync(coverFullPath, coverImageData)
    coverImagePath = `covers/${coverFileName}`
    console.log(`  -> Extracted cover image: ${coverFileName}`)
  }

  return {
    gameInfo,
    tracks,
    coverImage: coverImagePath
  }
}

async function main() {
  console.log('Scanning dist folder for zip files...')

  // Ensure output directories exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true })
  }

  const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.zip'))
  console.log(`Found ${files.length} zip files`)

  const manifest = {
    generatedAt: new Date().toISOString(),
    games: []
  }

  for (const file of files) {
    console.log(`Processing ${file}...`)
    const zipPath = path.join(DIST_DIR, file)
    const gameId = path.basename(file, '.zip').replace(/[^a-zA-Z0-9]/g, '_')

    try {
      const { gameInfo, tracks, coverImage } = await processZipFile(zipPath, gameId)

      const game = {
        id: gameId,
        zipFile: file,
        title: gameInfo?.title || path.basename(file, '.zip'),
        titleJp: gameInfo?.titleJp || '',
        system: gameInfo?.system || 'Unknown',
        author: gameInfo?.author || '',
        coverImage: coverImage,
        trackCount: tracks.length,
        tracks: tracks
      }

      manifest.games.push(game)
      console.log(`  -> ${game.title} (${tracks.length} tracks)`)

      // Copy zip file to public/dist
      const destPath = path.join(OUTPUT_DIR, file)
      fs.copyFileSync(zipPath, destPath)

    } catch (e) {
      console.error(`  Error processing ${file}:`, e.message)
    }
  }

  // Write manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  console.log(`\nManifest written to ${MANIFEST_PATH}`)
  console.log(`Total: ${manifest.games.length} games`)
}

main().catch(console.error)
