"use client";

import { useEffect } from "react";
import { BUILD_VERSION } from "~/lib/build";

/** Detecta SW novo (skipWaiting → controllerchange) e recarrega uma vez por versão. */
export function SWUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const guardKey = `sw-reloaded-${BUILD_VERSION}`;

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      if (!sessionStorage.getItem(guardKey)) {
        sessionStorage.setItem(guardKey, "1");
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.ready
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
