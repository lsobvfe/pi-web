"use client";

import { useEffect, useState } from "react";

export interface PiWebEmbeddedHost {
  request(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  eventSource?(url: string): EventSource;
}

let activeHost: PiWebEmbeddedHost | null = null;

export function configurePiWebEmbeddedHost(host: PiWebEmbeddedHost): void {
  activeHost = host;
}

export function clearPiWebEmbeddedHost(host: PiWebEmbeddedHost): void {
  if (activeHost === host) activeHost = null;
}

export function piWebFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const host = activeHost;
  if (host) return host.request(input, init);
  return globalThis.fetch(input, init);
}

export function piWebEventSource(url: string): EventSource {
  const host = activeHost;
  if (host?.eventSource) return host.eventSource(url);
  if (typeof window === "undefined") throw new Error("PI_WEB_BROWSER_REQUIRED");
  return new EventSource(url);
}

export function usePiWebResourceUrl(url: string | null): string | null {
  const [resourceUrl, setResourceUrl] = useState<string | null>(url);

  useEffect(() => {
    if (!url || !url.startsWith("/api/")) {
      setResourceUrl(url);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;
    setResourceUrl(null);
    void piWebFetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`PI_WEB_RESOURCE_${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setResourceUrl(objectUrl);
      })
      .catch(() => {
        if (active) setResourceUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return resourceUrl;
}
