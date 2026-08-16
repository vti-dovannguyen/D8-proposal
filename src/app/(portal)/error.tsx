"use client";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[portal] route error:", error);
  }, [error]);
  return <ErrorState title="Không tải được nội dung. Vui lòng thử lại." onRetry={reset} />;
}
