"use client";

import { Toaster } from "sonner";
import NetworkStatus from "@/components/NetworkStatus";
import RootInitializer from "@/app/components/RootInitializer";
import TriggerCleanup from "@/app/TriggerCleanup";
import DevToolsDetector from "@/app/components/DevToolsDetector";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DevToolsDetector />
      <RootInitializer serverInfo={null}>{children}</RootInitializer>
      <NetworkStatus />
      <TriggerCleanup />
    </>
  );
}
