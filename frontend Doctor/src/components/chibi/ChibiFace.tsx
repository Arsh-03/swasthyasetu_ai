// CHIBI's face (Central Health Informatics Bot Interface). One small SVG whose mood shows what the assistant is
// doing: idle (blinks now and then), listening (sound rings), thinking (dots), hint (something ready), alert (red).
import './chibi.css';

export type ChibiMood = 'idle' | 'listening' | 'thinking' | 'hint' | 'alert';

export function ChibiFace({ mood = 'idle', size = 56, badge }: { mood?: ChibiMood; size?: number; badge?: number }) {
  return (
    <span className={`chibi chibi-${mood}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        {/* sound rings while listening */}
        <circle className="chibi-ring r1" cx="32" cy="34" r="26" />
        <circle className="chibi-ring r2" cx="32" cy="34" r="26" />
        {/* antenna */}
        <line x1="32" y1="9" x2="32" y2="15" className="chibi-stroke" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="7.5" r="3.6" className="chibi-light" />
        {/* head */}
        <rect x="10" y="14" width="44" height="38" rx="17" className="chibi-head" />
        <rect x="15" y="20" width="34" height="25" rx="12" className="chibi-screen" />
        {/* ears */}
        <rect x="5" y="27" width="6" height="12" rx="3" className="chibi-ear" />
        <rect x="53" y="27" width="6" height="12" rx="3" className="chibi-ear" />
        {/* eyes */}
        <g className="chibi-eyes">
          <ellipse cx="25" cy="31" rx="3.4" ry="4.2" className="chibi-eye" />
          <ellipse cx="39" cy="31" rx="3.4" ry="4.2" className="chibi-eye" />
        </g>
        {/* mouth or thinking dots */}
        <path d="M27 38.5 Q32 42 37 38.5" className="chibi-mouth" fill="none" strokeWidth="2.2" strokeLinecap="round" />
        <g className="chibi-dots">
          <circle cx="26" cy="40" r="1.6" /><circle cx="32" cy="40" r="1.6" /><circle cx="38" cy="40" r="1.6" />
        </g>
        {/* cheeks */}
        <circle cx="19.5" cy="38" r="2.2" className="chibi-cheek" />
        <circle cx="44.5" cy="38" r="2.2" className="chibi-cheek" />
        {/* little body */}
        <rect x="22" y="52" width="20" height="9" rx="4.5" className="chibi-head" />
      </svg>
      {badge ? <span className="chibi-badge">{badge > 9 ? '9+' : badge}</span> : null}
    </span>
  );
}
