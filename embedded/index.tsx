"use client";

import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/hooks/useI18n";
import {
  clearPiWebEmbeddedHost,
  configurePiWebEmbeddedHost,
  type PiWebEmbeddedHost,
} from "@/lib/embedded-host";

export interface PiWebEmbeddedProps extends PiWebEmbeddedHost {
  className?: string;
}

export function PiWebEmbedded({ request, eventSource, className }: PiWebEmbeddedProps) {
  const host = useMemo<PiWebEmbeddedHost>(
    () => ({ request, eventSource }),
    [request, eventSource],
  );

  configurePiWebEmbeddedHost(host);
  useEffect(() => () => clearPiWebEmbeddedHost(host), [host]);

  return (
    <I18nProvider>
      <div className={className ?? "pi-web-embedded-root"}>
        <AppShell />
      </div>
    </I18nProvider>
  );
}
