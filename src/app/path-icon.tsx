// An icon drawn from a single path. It is as tall as a line of a button's
// text, so a button keeps its height when the icon gives way to words.
export default function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
      <path d={path} />
    </svg>
  );
}
