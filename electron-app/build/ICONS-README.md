# App Icons

electron-builder reads platform icons from the `build/` directory (the
`directories.buildResources` folder). You must provide the following files.
They are **not** committed as binaries here — generate them before building.

## Required files

| File                | Platform | Format / size                                             |
| ------------------- | -------- | --------------------------------------------------------- |
| `build/icon.ico`    | Windows  | Multi-resolution `.ico`, **must include 256×256**         |
| `build/icon.icns`   | macOS    | Apple `.icns`, includes up to 1024×1024                   |
| `build/icon.png`    | (source) | Square PNG, **512×512** (or 1024×1024) — used to generate |

`electron-builder.yml` references:
- `win.icon: build/icon.ico`
- `mac.icon: build/icon.icns`

## How to generate

Start from one high-resolution square master PNG (transparent background),
ideally **1024×1024**, named `build/icon.png`.

### Option A — electron-icon-builder (easiest, cross-platform)

```bash
npx electron-icon-builder --input=build/icon.png --output=build --flatten
# produces icons/ with icon.ico + icon.icns; move/rename into build/
```

### Option B — png2icons (pure Node, no native deps)

```bash
npx png2icons build/icon.png build/icon -allwe
# -a = all formats, -i .ico, -c .icns; writes build/icon.ico + build/icon.icns
```

### Option C — native tooling

macOS `.icns` (on a Mac):

```bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns
```

Windows `.ico` (with ImageMagick, any OS):

```bash
magick icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

## Notes

- The `.ico` **must** contain a 256×256 layer or electron-builder/NSIS will warn
  or fail.
- Keep the master art square with safe margins; macOS applies its own rounded
  mask, Windows does not.
- After generating, verify `build/icon.ico` and `build/icon.icns` exist before
  running `electron-builder`.
