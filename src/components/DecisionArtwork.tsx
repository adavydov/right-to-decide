type DecisionArtworkProps = {
  className?: string;
};

export function DecisionArtwork({ className }: DecisionArtworkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 1600 900"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      role="presentation"
      focusable="false"
    >
      <rect x="1160" y="0" width="440" height="256" fill="#c74b36" />

      <g stroke="#292927" strokeWidth="2">
        <path d="M102 734H1498" />
        <path d="M102 748H1498" />
        <path d="M318 716V766M610 716V766M904 716V766M1196 716V766" />
        <path d="M184 604L334 454L502 604L668 340L842 604L1048 418L1260 604" />
        <path d="M184 604H1260" />
        <circle cx="334" cy="454" r="10" fill="#f3efe8" />
        <circle cx="668" cy="340" r="10" fill="#f3efe8" />
        <circle cx="1048" cy="418" r="10" fill="#f3efe8" />
        <path d="M1260 604H1438V386" />
        <path d="M1424 406L1438 386L1452 406" />
      </g>

      <g stroke="#292927" strokeWidth="1.5">
        <rect x="520" y="166" width="116" height="300" />
        <rect x="808" y="166" width="116" height="300" />
        <rect x="1096" y="166" width="116" height="300" />
        <path d="M540 204H616M540 228H616M540 252H616" />
        <path d="M828 204H904M828 228H904M828 252H904" />
        <path d="M1116 204H1192M1116 228H1192M1116 252H1192" />
        <path d="M636 316H808M924 316H1096" />
        <path d="M780 302L808 316L780 330M1068 302L1096 316L1068 330" />
        <path d="M578 466V604M866 466V604M1154 466V604" strokeDasharray="8 10" />
      </g>

      <g fill="#292927" fontFamily="Arial, Helvetica, sans-serif" fontSize="22" fontWeight="700" letterSpacing="3" opacity="0.22">
        <text x="502" y="132">MODEL</text>
        <text x="766" y="132">JUDGMENT</text>
        <text x="1064" y="132">EVIDENCE</text>
        <text x="1134" y="822">RESPONSIBILITY</text>
      </g>

      <g fill="#292927">
        <circle cx="184" cy="604" r="6" />
        <circle cx="502" cy="604" r="6" />
        <circle cx="842" cy="604" r="6" />
        <circle cx="1260" cy="604" r="6" />
      </g>
    </svg>
  );
}
