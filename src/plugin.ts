import streamDeck, {
  action,
  KeyDownEvent,
  SendToPluginEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";

import { isTvOn, sendWakeOnLan, turnOffTv, getInputList, switchInput } from "./lg-tv";

// ─── Toggle Power ─────────────────────────────────────────────────────────────

type PowerSettings = {
  ip: string;
  mac: string;
  clientKey: string;
};

const STATE_OFF = 0;
const STATE_ON  = 1;

@action({ UUID: "com.cn.tv-power.toggle" })
class TogglePower extends SingletonAction<PowerSettings> {
  async onKeyDown(ev: KeyDownEvent<PowerSettings>): Promise<void> {
    const settings = await ev.action.getSettings();
    const { ip, mac } = settings;
    let { clientKey } = settings;

    if (!ip || !mac) { await ev.action.showAlert(); return; }

    const on = await isTvOn(ip);
    if (on) {
      try {
        await turnOffTv({
          ip, mac, clientKey,
          onClientKey: async (key) => {
            clientKey = key;
            await ev.action.setSettings({ ...settings, clientKey: key });
          },
        });
        await ev.action.setState(STATE_OFF);
      } catch {
        await ev.action.showAlert();
      }
    } else {
      try {
        await sendWakeOnLan(mac);
        await ev.action.setState(STATE_ON);
      } catch {
        await ev.action.showAlert();
      }
    }
  }

  async onWillAppear(ev: WillAppearEvent<PowerSettings>): Promise<void> {
    const { ip } = await ev.action.getSettings();
    if (!ip) return;
    const on = await isTvOn(ip, 1000);
    await ev.action.setState(on ? STATE_ON : STATE_OFF);
  }
}

// ─── Switch Input ─────────────────────────────────────────────────────────────

type InputSettings = {
  ip: string;
  clientKey: string;
  inputId: string;
  inputLabel: string;
};

type ToPluginMsg = { event: "getInputList" };

@action({ UUID: "com.cn.tv-power.switch-input" })
class SwitchInput extends SingletonAction<InputSettings> {
  async onKeyDown(ev: KeyDownEvent<InputSettings>): Promise<void> {
    const settings = await ev.action.getSettings();
    const { ip, inputId } = settings;
    let { clientKey } = settings;

    if (!ip || !inputId) { await ev.action.showAlert(); return; }

    try {
      await switchInput({
        ip,
        mac: "",
        clientKey,
        inputId,
        onClientKey: async (key) => {
          clientKey = key;
          await ev.action.setSettings({ ...settings, clientKey: key });
        },
      });
    } catch {
      await ev.action.showAlert();
    }
  }

  async onWillAppear(ev: WillAppearEvent<InputSettings>): Promise<void> {
    const { inputLabel } = await ev.action.getSettings();
    if (inputLabel) await ev.action.setTitle(inputLabel);
  }

  async onSendToPlugin(ev: SendToPluginEvent<ToPluginMsg, InputSettings>): Promise<void> {
    if (ev.payload.event !== "getInputList") return;

    const settings = await ev.action.getSettings();
    if (!settings.ip) {
      await ev.action.sendToPropertyInspector({ error: "IP address is not configured." });
      return;
    }

    try {
      const inputs = await getInputList({
        ip: settings.ip,
        clientKey: settings.clientKey,
        onClientKey: async (key) => {
          await ev.action.setSettings({ ...settings, clientKey: key });
        },
      });
      await ev.action.sendToPropertyInspector({ inputs });
    } catch (err) {
      await ev.action.sendToPropertyInspector({ error: String(err) });
    }
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

streamDeck.actions.registerAction(new TogglePower());
streamDeck.actions.registerAction(new SwitchInput());
streamDeck.connect();
