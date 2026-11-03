/**
 * Qual passo de "deixar o app pronto" mostrar para o aluno. Puro (sem
 * window), para testar em tests/unit/app-setup.test.mts.
 *
 * Ordem: abrir no navegador (se estiver preso no Instagram/WhatsApp) →
 * instalar na tela inicial → ativar notificações. No iPhone o push só
 * existe com o app instalado, então lá instalar vem obrigatoriamente antes.
 */

export type SetupStep =
  | "open-in-browser"
  | "install-android-prompt"
  | "install-android-manual"
  | "install-ios"
  | "push";

export type SetupEnv = {
  ua: string;
  /** já aberto como app instalado (display-mode standalone) */
  standalone: boolean;
  /** Chrome/Android entregou o beforeinstallprompt */
  hasInstallPrompt: boolean;
  pushSupported: boolean;
  permission: NotificationPermission | "unsupported";
  pushActive: boolean;
  installSnoozed: boolean;
  pushSnoozed: boolean;
};

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|TikTok|musical_ly|Snapchat|Twitter|; wv\)/i;

export function isIOS(ua: string): boolean {
  return /iphone|ipad|ipod/i.test(ua);
}

export function isAndroid(ua: string): boolean {
  return /android/i.test(ua);
}

export function isInAppBrowser(ua: string): boolean {
  return IN_APP.test(ua);
}

export function appSetupStep(env: SetupEnv): SetupStep | null {
  const mobile = isIOS(env.ua) || isAndroid(env.ua);

  if (mobile && !env.standalone && !env.installSnoozed) {
    if (isInAppBrowser(env.ua)) return "open-in-browser";
    if (isIOS(env.ua)) return "install-ios";
    return env.hasInstallPrompt ? "install-android-prompt" : "install-android-manual";
  }

  const canAskPush =
    env.pushSupported && !env.pushActive && env.permission !== "denied" && !env.pushSnoozed;
  return canAskPush ? "push" : null;
}
