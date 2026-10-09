/** The DéjàFind mark (from public/brand/mark.svg) beside the word set in Figtree 600. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg viewBox="0 0 64 64" className="size-8 -ml-1" aria-hidden>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="currentColor"
          d="M18 8L36 8L44 22L50 14L50 52A4 4 0 0 1 46 56L18 56A4 4 0 0 1 14 52L14 12A4 4 0 0 1 18 8Z M23.5 36H40.5A2.5 2.5 0 0 1 43 38.5A2.5 2.5 0 0 1 40.5 41H23.5A2.5 2.5 0 0 1 21 38.5A2.5 2.5 0 0 1 23.5 36Z"
        />
      </svg>
      <span className="text-[22px] font-semibold tracking-[-0.02em]">DéjàFind</span>
    </span>
  );
}
