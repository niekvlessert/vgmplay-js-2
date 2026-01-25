# 9-Player (舊-Player)

> **9 = 舊 (구)** - 옛것을 플레이하다

레트로 게임 음악(VGM)을 브라우저에서 재생하는 모던 웹 플레이어입니다.

## Features

- **Real-time Audio Visualization** - 주파수 스펙트럼 시각화
- **Cover Art Display** - 앨범 커버 이미지 확대 보기
- **Responsive Design** - 데스크탑/모바일 반응형 지원
- **Auto-play** - 트랙 자동 재생 및 다음 곡 넘기기
- **Keyboard Shortcuts** - 키보드로 빠른 조작

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `N` | Next Track |
| `P` | Previous Track |
| `S` | Stop |

## Tech Stack

- **Frontend**: React 19 + Vite
- **Audio Engine**: VGMPlay (WebAssembly)
- **Styling**: CSS with CSS Variables

## Getting Started

### Development

```bash
cd frontend
npm install
npm run dev
```

### Build

```bash
cd frontend
npm run build
```

### Deploy to Vercel

1. Vercel에서 GitHub 리포지토리 연결
2. Root Directory: `frontend`
3. Deploy

## Supported Formats

VGMPlay에서 지원하는 모든 포맷:
- VGM/VGZ (Video Game Music)
- 다양한 레트로 사운드 칩 지원 (YM2612, SN76489, YM2151, etc.)

## Credits

- Original [vgmplay-js](https://github.com/nickvlessert/vgmplay-js-2) by Niek Vlessert
- [VGMPlay](https://github.com/vgmrips/vgmplay) - VGM playback library
- Music files from [VGMRips](https://vgmrips.net)

## License

MIT License
