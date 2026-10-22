"use client";

import { useState } from "react";
import { btn } from "./ui";

// 글을 클립보드에 복사한다. http 접속처럼 clipboard API가 없으면 execCommand로 대신한다.
async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  el.remove();
  if (!ok) throw new Error("copy failed");
}

export function CopyButton({ text, label = "복사", className = btn.small }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await copyText(text);
          setState("done");
        } catch {
          setState("error");
        }
        setTimeout(() => setState("idle"), 1500);
      }}
    >
      {state === "done" ? "복사했어요" : state === "error" ? "복사 못 했어요" : label}
    </button>
  );
}
