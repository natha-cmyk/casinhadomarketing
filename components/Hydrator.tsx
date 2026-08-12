"use client";
// Hidrata a store a partir do banco no mount e persiste alterações (debounced) por fatia.
// Tolerante a falha: sem banco, o fetch falha silenciosamente e a app segue com o seed.
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { fetchAll, saveConfig, savePerfil, saveOkr, savePosts, savePersonas, saveConcorrentes } from "@/lib/api";

export function Hydrator() {
  useEffect(() => {
    let alive = true;
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    const debounce = (key: string, fn: () => void) => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(fn, 600);
    };
    let unsub: (() => void) | undefined;

    (async () => {
      const data = await fetchAll();
      if (!alive) return;
      useStore.getState().hydrate(data);
      // contas conectadas na Zernio (não bloqueia a hidratação)
      fetch("/api/zernio/accounts")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d?.accounts) useStore.getState().setZernioAccounts(d.accounts);
        })
        .catch(() => {});
      unsub = useStore.subscribe((s, p) => {
        if (!s.hydrated) return;
        if (s.redes !== p.redes || s.paineis !== p.paineis || s.contas !== p.contas || s.cfgOpen !== p.cfgOpen || s.impOpen !== p.impOpen)
          debounce("config", () => saveConfig(useStore.getState()));
        if (s.perfil !== p.perfil) debounce("perfil", () => savePerfil(useStore.getState()));
        if (s.okr !== p.okr) debounce("okr", () => saveOkr(useStore.getState()));
        if (s.posts !== p.posts) debounce("posts", () => savePosts(useStore.getState()));
        if (s.personas !== p.personas) debounce("personas", () => savePersonas(useStore.getState()));
        if (s.concorrentes !== p.concorrentes) debounce("concorrentes", () => saveConcorrentes(useStore.getState()));
      });
    })();

    return () => {
      alive = false;
      if (unsub) unsub();
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);
  return null;
}
