import test from "node:test";
import assert from "node:assert/strict";
import { appSetupStep, type SetupEnv } from "~/lib/app-setup";

/** Qual passo de configuração mostrar: instalar, abrir no navegador, ativar push. */

const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const INSTAGRAM_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 350.0.0";
const FACEBOOK_ANDROID = "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0]";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const base: SetupEnv = {
  ua: ANDROID_CHROME,
  standalone: false,
  hasInstallPrompt: false,
  pushSupported: true,
  permission: "default",
  pushActive: false,
  installSnoozed: false,
  pushSnoozed: false,
};

test("Android com instalador pronto: instalar com 1 toque", () => {
  assert.equal(appSetupStep({ ...base, hasInstallPrompt: true }), "install-android-prompt");
});

test("Android sem instalador (Samsung, etc.): passo a passo do menu", () => {
  assert.equal(appSetupStep(base), "install-android-manual");
});

test("iPhone no Safari: passo a passo do Compartilhar", () => {
  assert.equal(appSetupStep({ ...base, ua: IPHONE_SAFARI, pushSupported: false }), "install-ios");
});

test("aberto dentro do Instagram/Facebook/WhatsApp: abrir no navegador primeiro", () => {
  assert.equal(appSetupStep({ ...base, ua: INSTAGRAM_IOS }), "open-in-browser");
  assert.equal(appSetupStep({ ...base, ua: FACEBOOK_ANDROID }), "open-in-browser");
});

test("já instalado: próximo passo é ativar notificações", () => {
  assert.equal(appSetupStep({ ...base, standalone: true }), "push");
});

test("instalado e push ativo: nada a mostrar", () => {
  assert.equal(appSetupStep({ ...base, standalone: true, pushActive: true, permission: "granted" }), null);
});

test("push recusado no aparelho: não insiste", () => {
  assert.equal(appSetupStep({ ...base, standalone: true, permission: "denied" }), null);
});

test("instalar adiado: oferece o push se der (Android navegador)", () => {
  assert.equal(appSetupStep({ ...base, installSnoozed: true }), "push");
});

test("iPhone fora do app não tem push: com instalar adiado, nada", () => {
  assert.equal(appSetupStep({ ...base, ua: IPHONE_SAFARI, pushSupported: false, installSnoozed: true }), null);
});

test("computador: não pede instalação, só notificação", () => {
  assert.equal(appSetupStep({ ...base, ua: DESKTOP }), "push");
  assert.equal(appSetupStep({ ...base, ua: DESKTOP, pushSnoozed: true }), null);
});
