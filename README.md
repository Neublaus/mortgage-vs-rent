# mortgage-vs-rent

## Image tone automation demo

This repository contains a static browser demo for matching uploaded images to a master image's color tone, brightness, and contrast.

### Open locally

Start the local web server first:

```bash
npm start
```

Then open <http://127.0.0.1:4173/> in a browser on the same machine. The server also tries to serve <http://127.0.0.1/> on port `80` when that port is available, so typing only `127.0.0.1` can work too.

If you see **“127.0.0.1 refused to connect”**, either the server is not running or you opened the wrong port. Start it with `npm start`, keep that terminal open, and open the exact URL printed by the terminal. If you are using a cloud IDE, Codespaces, or another remote workspace, open or forward port `4173` from that environment instead of using your computer's `127.0.0.1` directly.

You can change the bind address or port if needed:

```bash
HOST=0.0.0.0 PORT=8080 npm start
# Disable the optional port 80 listener if it conflicts with another app:
DISABLE_PORT_80=1 npm start
```

### Use the automation

1. Upload a master image in the **Settings** panel.
2. Click **Open upload window**.
3. Upload or drop images into the window to preview them matched to the master look and feel.
