"use client";

import { useEffect, useState } from "react";
import { getInitialNavigation, type InitialNavigation } from "@/lib/initial-navigation";

export interface PiWebNavigation {
  searchParams: URLSearchParams;
  replace(href: string, options?: { scroll?: boolean }): void;
}

export function usePiWebNavigation(): PiWebNavigation {
  const [searchParams, setSearchParams] = useState(() => (
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search)
  ));

  useEffect(() => {
    const sync = () => setSearchParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return {
    searchParams,
    replace(href) {
      const url = new URL(href, window.location.href);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      setSearchParams(new URLSearchParams(url.search));
    },
  };
}

export function initialNavigation(searchParams: Pick<URLSearchParams, "get">): InitialNavigation {
  return getInitialNavigation(searchParams);
}
