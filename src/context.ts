import { createContext, useContext } from "react";
import type { Hangout, Currency } from "../shared/engine";
import type { Key } from "./i18n";
export type Context = {
  t: (k: Key) => string;
  lang: string;
  setLang: (s: string) => void;
  theme: string;
  setTheme: (s: string) => void;
  me: {
    id: string;
    name: string;
    demo: boolean;
    onboarded?: boolean;
    avatarUrl?: string;
    username?: string;
  };
  hangouts: Hangout[];
  reload: () => Promise<void>;
  api: <T = any>(
    path: string,
    method?: string,
    body?: any,
    headers?: Record<string, string>,
  ) => Promise<T>;
  toast: (s: string) => void;
  money: (n: number, c: Currency) => string;
  refreshIdentity: () => Promise<void>;
  guestEnabled: boolean;
};
export const C = createContext<Context>(null!);
export const useApp = () => useContext(C);
