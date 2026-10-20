"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isPushSupported,
  subscribePush,
  unsubscribePush,
} from "~/lib/push-client";

type PushPermission = NotificationPermission | "unsupported";

/**
 * Estado do Web Push no dispositivo: suporte, permissão e progresso.
 * enable/disable devolvem booleano para a UI mostrar toast sem quebrar.
 */
export function usePush() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [active, setActive] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setPermission("unsupported");
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setActive(!!sub))
      .catch(() => {
        /* sem SW ainda: fica inativo */
      });
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    setEnabling(true);
    try {
      const ok = await subscribePush();
      setPermission(Notification.permission);
      setActive(ok);
      return ok;
    } catch {
      setPermission(
        typeof Notification !== "undefined" ? Notification.permission : "default"
      );
      setActive(false);
      return false;
    } finally {
      setEnabling(false);
    }
  }, []);

  const disable = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    setEnabling(true);
    try {
      const ok = await unsubscribePush();
      setActive(false);
      return ok;
    } catch {
      return false;
    } finally {
      setEnabling(false);
    }
  }, []);

  return { supported, permission, active, enabling, enable, disable };
}
