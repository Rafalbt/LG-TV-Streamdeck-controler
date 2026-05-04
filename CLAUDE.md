# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build (compiles src/ → com.cn.tv-power.sdPlugin/bin/plugin.js)
npm run build

# Watch mode (rebuild on file change)
npm run watch
```

There are no tests. To manually test, copy `com.cn.tv-power.sdPlugin/` to `%APPDATA%\Elgato\StreamDeck\Plugins\` and restart Stream Deck.

## Architecture

The plugin is a Node.js process managed by Elgato Stream Deck. `src/plugin.ts` is the entry point; esbuild bundles it (with all dependencies) into a single CJS file at `com.cn.tv-power.sdPlugin/bin/plugin.js`.

### TV communication (`src/lg-tv.ts`)

All LG webOS communication goes through `connectAndRequest<T>()` — a private function that:
1. Opens a WebSocket to `ws://<ip>:3000`
2. Sends a `register` message with `REGISTER_PAYLOAD` and the stored `client-key`
3. On first use (no key), the TV shows an "Allow" prompt — the user must accept with the remote; the TV returns a new `client-key` which is passed to `onClientKey` and persisted in action settings
4. Sends the actual request (`ssap://...` URI) and resolves with the response payload

Power-on uses Wake-on-LAN (`sendWakeOnLan`) because the TV is unreachable over the network when off. Power state is detected by attempting a raw TCP connection to port 3000 (`isTvOn`).

### Stream Deck actions (`src/plugin.ts`)

Two actions, both registered at the bottom of the file:

| Class | UUID | What it does |
|---|---|---|
| `TogglePower` | `com.cn.tv-power.toggle` | WoL to turn on, webOS `ssap://system/turnOff` to turn off. Two button states: off (0) / on (1). |
| `SwitchInput` | `com.cn.tv-power.switch-input` | `ssap://tv/switchInput`. Supports a PI→plugin→PI round-trip: the Property Inspector sends `{ event: "getInputList" }` via `sendToPlugin`, the action fetches `ssap://tv/getExternalInputList` and returns the result to the PI via `sendToPropertyInspector`. |

Settings are persisted per-action-instance by Stream Deck. The `clientKey` is stored there and updated transparently whenever the TV issues a new one.

### Property Inspectors (`com.cn.tv-power.sdPlugin/ui/`)

Plain HTML files that communicate with Stream Deck via `connectElgatoStreamDeckSocket`. They use `getSettings`/`setSettings` events for persistence. `switch-input.html` additionally uses the plugin messaging round-trip described above to populate the input dropdown.

## webOS Protocol notes

- Every session starts with a `register` message; registration must complete before any `request` can be sent.
- `client-key` must be stored and reused across sessions — losing it requires re-pairing (user prompt on TV).
- `ssap://` URIs are LG's proprietary scheme; they are not URLs.
- TV must be on standby (not hard-off) for WoL to work — LAN port must remain powered.
