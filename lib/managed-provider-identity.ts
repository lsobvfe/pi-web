import type { InlineExtension } from "@earendil-works/pi-coding-agent";
import type { ProviderHeaders } from "@earendil-works/pi-ai";

const OPENAI_SDK_IDENTITY_HEADERS = [
  "User-Agent",
  "X-Stainless-Lang",
  "X-Stainless-Package-Version",
  "X-Stainless-OS",
  "X-Stainless-Arch",
  "X-Stainless-Runtime",
  "X-Stainless-Runtime-Version",
  "X-Stainless-Retry-Count",
  "X-Stainless-Timeout",
] as const;

export function clearManagedProviderSdkIdentity(headers: ProviderHeaders): void {
  for (const name of OPENAI_SDK_IDENTITY_HEADERS) {
    headers[name] = null;
  }
}

export function createManagedProviderIdentityExtension(): InlineExtension {
  return {
    name: "pi-web-managed-provider-identity",
    hidden: true,
    factory: (pi) => {
      pi.on("before_provider_headers", (event) => {
        clearManagedProviderSdkIdentity(event.headers);
      });
    },
  };
}
