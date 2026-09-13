# Markdown Viewer

Desktop Markdown reader for Ubuntu now, with Windows and macOS packaging hooks already in the project.

## What it does

- Opens `.md`, `.markdown`, `.mdown`, `.mkd`, and `.mdwn` files
- Renders GitHub-flavored Markdown (tables, task lists, fenced code)
- Reloads when the file changes on disk
- Registers itself as the default Markdown viewer on Ubuntu

## Ubuntu (this machine)

```bash
npm install
npm run install:linux
npm start
```

After `install:linux`, Ubuntu uses this app for Markdown files:

- Double-click a `.md` file in Files
- `xdg-open path/to/file.md`
- `markdown-viewer path/to/file.md` (installed to `~/.local/bin`)

The first app launch also writes the `.desktop` entry and mime defaults, so association survives a reboot of the session.

From the project folder:

```bash
npm start -- /path/to/file.md
```

## Windows and macOS (later)

The main process already handles:

- Windows/Linux: files passed on the command line
- macOS: `open-file` events from Finder
- Single-instance hand-off so a second double-click reuses the window

Build installers on those OS:

```bash
npm run dist:win
npm run dist:mac
```

File associations for those platforms are defined in `package.json` (`build.fileAssociations`) and are applied by the packaged installer, not by the Linux desktop-entry script.

## Shortcuts

- `Ctrl+O` open file
- `Ctrl+F` find in document
- `F3` / `Shift+F3` next / previous match
- `Ctrl+B` toggle contents
- `Ctrl+Shift+W` cycle page width (Compact / Comfortable / Wide / Fill)
- `Ctrl+Shift+T` cycle theme
- `Ctrl+P` print
