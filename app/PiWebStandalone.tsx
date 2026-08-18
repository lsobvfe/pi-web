"use client";

import { useMemo, type ReactNode } from "react";
import {
  PiWebHostProvider,
  type PiWebHost,
} from "@/embedded/PiWebHost";

export function PiWebStandalone({ children }: { children: ReactNode }) {
  const host = useMemo<PiWebHost>(() => ({
    request: (input, init) => window.fetch(input, init),
    eventSource: (url) => new window.EventSource(url),
  }), []);

  return <PiWebHostProvider host={host}>{children}</PiWebHostProvider>;
}
