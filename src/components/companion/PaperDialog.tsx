"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Native dialog supplies modal focus trapping, Esc and return focus; page scrolling stays put. */
export function PaperDialog({
  label,
  onClose,
  className,
  children,
}: {
  label: string;
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!,
      prev = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          onClose();
      }}
    >
      {children}
    </dialog>
  );
}
