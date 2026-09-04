"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getInitialNavigation, type InitialNavigation } from "@/lib/initial-navigation";

export interface PiWebNavigation {
  searchParams: URLSearchParams;
  replace(href: string, options?: { scroll?: boolean }): void;
}

type PiWebNavigationMode = "browser" | "memory";

const PiWebNavigationModeContext =
  createContext<PiWebNavigationMode>("browser");

export function PiWebMemoryNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  return createElement(
    PiWebNavigationModeContext.Provider,
    { value: "memory" },
    children,
  );
}

export function usePiWebNavigation(): PiWebNavigation {
  const mode = useContext(PiWebNavigationModeContext);
  const [searchParams, setSearchParams] = useState(
    () => (
      mode === "browser" && typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams()
    ),
  );

  useEffect(() => {
    if (mode !== "browser") return;
    const sync = () => setSearchParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [mode]);

  const replace = useCallback((href: string) => {
    const url = new URL(
      href,
      mode === "browser" ? window.location.href : "https://pi-web.local/",
    );
    if (mode === "browser") {
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setSearchParams(new URLSearchParams(url.search));
  }, [mode]);

  return useMemo(() => ({ searchParams, replace }), [replace, searchParams]);
}

export function initialNavigation(searchParams: Pick<URLSearchParams, "get">): InitialNavigation {
  return getInitialNavigation(searchParams);
}
