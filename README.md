# LG TV Power — Stream Deck Plugin

Stream Deck plugin for controlling an LG OLED TV over the local network.

## Actions

### Toggle Power
Turns the TV on or off with a single button press. The button icon reflects the current state (on/off) when Stream Deck starts.

- **Turn on** — sends a Wake-on-LAN magic packet (TV must be in network standby, not hard-off)
- **Turn off** — connects via webOS WebSocket API and sends a power-off command

### Switch Input
Switches the TV to a specific input (HDMI 1, HDMI 2, etc.). The button label updates to show the selected input name.

## Setup

### Requirements
- LG webOS TV on the same LAN as the computer running Stream Deck
- TV must have **network standby** enabled: Settings → General → Mobile TV On (or equivalent — label varies by model)
- Stream Deck software ≥ 6.4

### Installation
1. Build the plugin (see [Development](#development)) or use a pre-built release
2. Copy `com.cn.tv-power.sdPlugin/` to `%APPDATA%\Elgato\StreamDeck\Plugins\`
3. Restart Stream Deck

### Configuration

**Toggle Power**
| Field | Description |
|---|---|
| IP Address | Local IP of the TV (e.g. `192.168.1.100`) |
| MAC Address | Required for Wake-on-LAN (e.g. `A0:B1:C2:D3:E4:F5`) — find it at Settings → General → Network → Network Status |
| Client Key | Filled automatically after the first successful pairing |

**Switch Input**
| Field | Description |
|---|---|
| IP Address | Local IP of the TV |
| Input | Select from dropdown — click **Refresh** to fetch the live list from the TV |
| Client Key | Shared with Toggle Power if both actions point to the same TV; filled automatically |

### First use / pairing
On the first button press (or first "Refresh" in Switch Input), the TV displays an **"Allow access"** prompt. Accept it with the remote. The plugin saves the returned `client-key` in the action settings — subsequent uses connect without a prompt.

To force re-pairing, click **Clear key** in the Toggle Power property inspector.

## Development

```bash
npm install
npm run build   # outputs to com.cn.tv-power.sdPlugin/bin/plugin.js
npm run watch   # rebuild on change
```

**Stack:** TypeScript, [`@elgato/streamdeck`](https://www.npmjs.com/package/@elgato/streamdeck) SDK v2, [`ws`](https://www.npmjs.com/package/ws), esbuild.

After building, copy the `.sdPlugin` folder to the Plugins directory and restart Stream Deck to pick up changes.
