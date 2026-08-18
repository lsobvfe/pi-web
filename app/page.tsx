import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/hooks/useI18n";
import { PiWebStandalone } from "./PiWebStandalone";

export default function Home() {
  return (
    <Suspense>
      <PiWebStandalone>
        <I18nProvider>
          <AppShell />
        </I18nProvider>
      </PiWebStandalone>
    </Suspense>
  );
}
