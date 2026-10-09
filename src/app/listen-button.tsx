import Icon from "./path-icon";

// How far a reply has got with being spoken: it can be asked for, its audio
// is being prepared, it is being spoken, or it couldn't be.
export type Sound = "offered" | "loading" | "speaking" | "failed";

export const OFFER_BUTTON_STYLE =
  "rounded-full border border-black/15 px-3 py-1 text-sm disabled:opacity-40 dark:border-white/20";

const SPEAKER_ICON =
  "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";
export const MUTE_ICON =
  "M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z";

// The button under a reply that speaks it, in the conversation and among the
// saved exchanges. It gives way to a mute button while the reply is spoken.
export default function ListenButton({
  sound,
  onListen,
  onMute,
}: {
  sound: Sound;
  onListen: () => void;
  onMute: () => void;
}) {
  if (sound === "speaking") {
    return (
      <button onClick={onMute} aria-label="Silencia" className={OFFER_BUTTON_STYLE}>
        <Icon path={MUTE_ICON} />
      </button>
    );
  }
  if (sound === "loading") {
    return (
      <button disabled className={OFFER_BUTTON_STYLE}>
        Carregant…
      </button>
    );
  }
  return (
    <button onClick={onListen} aria-label="Escolta" className={OFFER_BUTTON_STYLE}>
      <Icon path={SPEAKER_ICON} />
    </button>
  );
}

export function ListenFailure() {
  return <p className="text-sm text-red-600">No s&apos;ha pogut reproduir l&apos;àudio.</p>;
}
