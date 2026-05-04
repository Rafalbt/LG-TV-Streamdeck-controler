import WebSocket from "ws";
import * as net from "net";
import * as dgram from "dgram";

export interface TvOptions {
  ip: string;
  mac: string;
  clientKey?: string;
  onClientKey?: (key: string) => void;
}

export interface TvInput {
  id: string;
  label: string;
  connected: boolean;
}

const REGISTER_PAYLOAD = {
  forcePairing: false,
  pairingType: "PROMPT",
  manifest: {
    manifestVersion: 1,
    appVersion: "1.1",
    permissions: [
      "CONTROL_POWER",
      "READ_POWER_STATE",
      "CONTROL_DISPLAY",
      "CONTROL_INPUT_MEDIA_PLAYBACK",
      "CONTROL_INPUT_TV",
    ],
  },
};

/** Returns true if the TV is reachable by attempting a TCP connection on port 3000. */
export function isTvOn(ip: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
    socket.connect(3000, ip, () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.on("error", () => { clearTimeout(timer); resolve(false); });
  });
}

/** Sends a Wake-on-LAN magic packet via UDP broadcast on port 9. */
export function sendWakeOnLan(mac: string): Promise<void> {
  const hex = mac.replace(/[:\-]/g, "");
  if (hex.length !== 12) return Promise.reject(new Error("Invalid MAC address: " + mac));

  const macBytes = Buffer.from(hex, "hex");
  const magic = Buffer.alloc(102);
  magic.fill(0xff, 0, 6);
  for (let i = 1; i <= 16; i++) macBytes.copy(magic, i * 6);

  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    sock.once("error", (err) => { sock.close(); reject(err); });
    sock.bind(() => {
      sock.setBroadcast(true);
      sock.send(magic, 0, magic.length, 9, "255.255.255.255", (err) => {
        sock.close();
        err ? reject(err) : resolve();
      });
    });
  });
}

/**
 * Opens a webOS WebSocket connection, registers the client, sends a single request,
 * and resolves with the response payload.
 */
function connectAndRequest<T>(
  ip: string,
  clientKey: string | undefined,
  onClientKey: ((key: string) => void) | undefined,
  uri: string,
  payload: object = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${ip}:3000`, { handshakeTimeout: 3000 });
    let reqId = 0;

    const timer = setTimeout(() => { ws.terminate(); reject(new Error("TV connection timed out")); }, 10_000);
    const send = (msg: object) => ws.send(JSON.stringify(msg));

    ws.on("open", () => {
      send({
        type: "register",
        id: "reg0",
        payload: { ...REGISTER_PAYLOAD, "client-key": clientKey ?? "" },
      });
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>;

      if (msg["type"] === "registered") {
        const key = (msg["payload"] as Record<string, unknown>)?.["client-key"] as string | undefined;
        if (key) onClientKey?.(key);
        reqId++;
        send({ type: "request", id: `req${reqId}`, uri, payload });
        return;
      }

      if (msg["type"] === "response" && msg["id"] === `req${reqId}`) {
        clearTimeout(timer);
        ws.close();
        resolve(msg["payload"] as T);
        return;
      }

      if (msg["type"] === "error") {
        clearTimeout(timer);
        ws.close();
        reject(new Error(String(msg["error"] ?? "webOS error")));
      }
    });

    ws.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

/** Sends a power-off command to the TV via the webOS API. */
export function turnOffTv(opts: TvOptions): Promise<void> {
  return connectAndRequest<void>(
    opts.ip,
    opts.clientKey,
    opts.onClientKey,
    "ssap://system/turnOff",
  );
}

/** Fetches the list of external inputs (HDMI, AV, etc.) from the TV. */
export async function getInputList(opts: Pick<TvOptions, "ip" | "clientKey" | "onClientKey">): Promise<TvInput[]> {
  const result = await connectAndRequest<{ devices?: RawDevice[] }>(
    opts.ip,
    opts.clientKey,
    opts.onClientKey,
    "ssap://tv/getExternalInputList",
  );
  return (result.devices ?? []).map((d) => ({
    id: d.id,
    label: d.label || d.id,
    connected: d.connected ?? false,
  }));
}

/** Switches the TV to the given input (e.g. "HDMI_1"). */
export function switchInput(opts: TvOptions & { inputId: string }): Promise<void> {
  return connectAndRequest<void>(
    opts.ip,
    opts.clientKey,
    opts.onClientKey,
    "ssap://tv/switchInput",
    { inputId: opts.inputId },
  );
}

interface RawDevice {
  id: string;
  label: string;
  connected?: boolean;
}
