"use client";

/**
 * ShareChips — social + copy-link affordances on a project dossier.
 *
 * Shipped for audit rec #96: finishing a dossier on mobile had no
 * viral-growth path. These chips give a reader who's just finished
 * reading a £3.2bn overrun on Sellafield one tap to push it to X,
 * LinkedIn, or WhatsApp with a pre-formatted caption carrying the
 * project name + short summary.
 *
 * Copy-link reuses the global useToast provider shipped in commit
 * 2/5 so the confirmation UX is consistent with citation copy.
 *
 * min-h-[44px] on every tappable surface — Apple HIG minimum.
 */

import { Twitter, Linkedin, Link2, MessageCircle } from "lucide-react";
import { useToast } from "../lib/useToast";

export default function ShareChips({ title, summary, url }) {
  const { show } = useToast();
  const shareUrl =
    typeof window !== "undefined"
      ? url || window.location.href
      : url || "";
  const text = summary
    ? `${title} — ${summary}`
    : String(title || "");
  const encoded = encodeURIComponent(shareUrl);
  const encText = encodeURIComponent(text);

  const links = [
    {
      label: "Share on X",
      Icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encText}&url=${encoded}`,
    },
    {
      label: "Share on LinkedIn",
      Icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
    },
    {
      label: "Share on WhatsApp",
      Icon: MessageCircle,
      href: `https://wa.me/?text=${encText}%20${encoded}`,
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} — ${shareUrl}`);
      show("Link copied");
    } catch {
      show("Copy failed");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 my-4">
      <span className="text-xs uppercase tracking-wider text-gray-400 mr-2">
        Share
      </span>
      {links.map(({ label, Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className={
            "inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] " +
            "rounded-md border border-gray-700 hover:border-amber-500 " +
            "hover:text-amber-400 text-sm text-gray-300 " +
            "transition-colors"
          }
        >
          <Icon size={14} />
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy link"
        className={
          "inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] " +
          "rounded-md border border-gray-700 hover:border-amber-500 " +
          "hover:text-amber-400 text-sm text-gray-300 " +
          "transition-colors"
        }
      >
        <Link2 size={14} />
      </button>
    </div>
  );
}
