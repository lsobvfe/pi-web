"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface PiWebHost {
  request(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  eventSource?(url: string): EventSource;
}

const PiWebHostContext = createContext<PiWebHost | null>(null);

export function PiWebHostProvider({
  host,
  children,
}: {
  host: PiWebHost;
  children: ReactNode;
}) {
  return (
    <PiWebHostContext.Provider value={host}>
      {children}
    </PiWebHostContext.Provider>
  );
}

export function usePiWebHost(): PiWebHost {
  const host = useContext(PiWebHostContext);
  if (!host) throw new Error("PI_WEB_HOST_REQUIRED");
  return host;
}

export function usePiWebClient() {
  const host = usePiWebHost();
  return useMemo(() => ({
    request: host.request,
    eventSource(url: string): EventSource {
      if (!host.eventSource) throw new Error("PI_WEB_EVENT_SOURCE_REQUIRED");
      return host.eventSource(url);
    },
  }), [host]);
}

export function usePiWebResourceUrl(url: string | null): string | null {
  const { request } = usePiWebClient();
  const [resourceUrl, setResourceUrl] = useState<string | null>(url);

  useEffect(() => {
    if (!url || !url.startsWith("/api/")) {
      setResourceUrl(url);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;
    setResourceUrl(null);
    void request(url)
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
  }, [request, url]);

  return resourceUrl;
}
