import { useCallback, useEffect, useRef, useState } from "react";
import { CopyIcon, ImageIcon } from "./icons";

// Long enough to read where the file went, short enough that it doesn't sit
// over the page for the rest of the session
const MESSAGE_MS = 8_000;

// Saving the card asks where to put it; copying it just takes the clipboard.
type ImageAction = "save" | "copy";

interface ExportMessage {
  text: string;
  failed: boolean;
}

interface Busy {
  gameId: number;
  action: ImageAction;
}

/**
 * Turning one game into a PNG: the main process draws the card and either runs
 * the save dialog or writes the clipboard, so all there is to hold here is
 * which game is in flight and what to say about the one that finished. Pages
 * that offer this from more than one place (a button and a context menu, say)
 * share a single instance so there is only ever one message on screen.
 */
export function useGameImageExport() {
  const [busy, setBusy] = useState<Busy | null>(null);
  const [message, setMessage] = useState<ExportMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const say = useCallback((text: string, failed: boolean) => {
    setMessage({ text, failed });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), MESSAGE_MS);
  }, []);

  const run = useCallback(
    async (gameId: number, action: ImageAction) => {
      if (busy != null) return;
      setBusy({ gameId, action });
      setMessage(null);
      try {
        if (action === "copy") {
          const result = await window.api.copyGameImage(gameId);
          if (result.success) say("Copied the game image to the clipboard", false);
          else if (result.error) say(result.error, true);
        } else {
          const result = await window.api.exportGameImage(gameId);
          if (result.success) say(`Saved to ${result.path}`, false);
          // Neither succeeded nor failed: the save dialog was dismissed
          else if (result.error) say(result.error, true);
        }
      } catch (err: any) {
        say(err.message, true);
      } finally {
        setBusy(null);
      }
    },
    [busy, say],
  );

  const busyWith = useCallback(
    (gameId: number, action: ImageAction) =>
      busy != null && busy.gameId === gameId && busy.action === action,
    [busy],
  );

  return { busyWith, message, run };
}

export function ExportImageMessage({ message }: { message: ExportMessage | null }) {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div
        className={`max-w-[600px] truncate rounded-lg border px-3 py-2 text-xs shadow-lg shadow-black/40 ${
          message.failed
            ? "border-lol-loss/40 bg-lol-card text-lol-loss"
            : "border-lol-border bg-lol-card text-lol-text-bright"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

const LABELS: Record<ImageAction, { idle: string; busy: string; title: string }> = {
  save: {
    idle: "Export PNG",
    busy: "Exporting...",
    title: "Save this game as a PNG",
  },
  copy: {
    idle: "Copy Image",
    busy: "Copying...",
    title: "Copy this game's image to the clipboard",
  },
};

export function ExportImageButton({
  action,
  onClick,
  busy,
}: {
  action: ImageAction;
  onClick: () => void;
  busy: boolean;
}) {
  const labels = LABELS[action];
  const Icon = action === "copy" ? CopyIcon : ImageIcon;

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={labels.title}
      className="flex items-center gap-1.5 rounded-lg border border-lol-border bg-lol-card px-2 py-1 text-xs text-lol-text transition-colors hover:border-lol-gold/60 hover:text-lol-text-bright disabled:opacity-60"
    >
      <Icon className="h-3.5 w-3.5" />
      {busy ? labels.busy : labels.idle}
    </button>
  );
}
