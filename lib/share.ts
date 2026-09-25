"use client";

/** Native share sheet where available, otherwise an X (Twitter) intent. */
export async function shareText(text: string, path: string): Promise<"shared" | "opened" | "cancelled"> {
  const url = `${window.location.origin}${path}`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text, url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(intent, "_blank", "noopener,noreferrer");
  return "opened";
}
