# dragon-speedrun

## Run locally (Electron)

```bash
npm install
npm start
```

## Build installers locally

```bash
npm run dist
```

Installers are created in `release/`.

## Ship via GitHub Releases (no self-hosting needed)

This repo includes a workflow at `.github/workflows/release.yml`.

1. Commit and push your changes to GitHub.
2. Create and push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. GitHub Actions will build for Linux/Windows/macOS and upload assets to a GitHub Release automatically.

Users can then download installers directly from the Releases page.

## Set websocket server URL in app build/runtime

The app reads websocket URL from `WS_URL` in Electron main process.

Example:

```bash
WS_URL=ws://your-server:8080 npm start
```
