import { useEffect, useState } from "react";

// Captura o evento beforeinstallprompt (Chrome/Edge) para oferecer a instalação do PWA.
// Em navegadores sem suporte (ex.: iOS Safari) canInstall fica false e nada aparece.
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
  };

  // iOS/Safari não dispara beforeinstallprompt: detecta o dispositivo e se ainda não
  // está em modo standalone, para instruir "Compartilhar → Adicionar à Tela de Início".
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const standalone = typeof window !== "undefined"
    && (window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches);

  return {
    canInstall: !!deferred && !dismissed,
    iosHint: isIOS && !standalone && !dismissed,
    install,
    dismiss: () => setDismissed(true),
  };
}
