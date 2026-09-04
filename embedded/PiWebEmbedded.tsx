"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/hooks/useI18n";
import { PiWebMemoryNavigationProvider } from "@/hooks/usePiWebNavigation";
import {
  PiWebHostProvider,
  type PiWebHost,
} from "./PiWebHost";

export interface PiWebEmbeddedProps extends PiWebHost {
  className?: string;
}

export function PiWebEmbedded({
  request,
  eventSource,
  className,
}: PiWebEmbeddedProps) {
  const host = useMemo<PiWebHost>(
    () => ({ request, eventSource }),
    [request, eventSource],
  );

  return (
    <PiWebHostProvider host={host}>
      <I18nProvider>
        <PiWebMemoryNavigationProvider>
          <div className={className ?? "pi-web-embedded-root"}>
            <AppShell />
          </div>
        </PiWebMemoryNavigationProvider>
      </I18nProvider>
    </PiWebHostProvider>
  );
}
