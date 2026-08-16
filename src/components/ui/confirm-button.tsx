"use client";
import { useState, useTransition } from "react";

export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Xác nhận?",
  className = "",
}: {
  onConfirm: () => void | Promise<void>;
  label: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={armed ? confirmLabel : label}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) { setArmed(true); return; }
        setArmed(false);
        start(() => Promise.resolve(onConfirm()));
      }}
      className={
        "rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 " +
        (armed ? "border-red-400 bg-red-600 text-white" : "border-red-200 text-red-600") +
        (className ? " " + className : "")
      }
    >
      {pending ? "Đang xử lý…" : armed ? confirmLabel : label}
    </button>
  );
}
