import React from 'react';

export type NavIconKind = 'logo' | 'main' | 'mic' | 'speaker' | 'flask' | 'gear';

type Props = {
  kind: NavIconKind;
  className?: string;
};

/** Lightweight SVG marks — avoids WebGL context exhaustion in the nav/dock. */
export function NavIcon({ kind, className }: Props) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true as const,
    className: className || 'nav-svg',
  };

  switch (kind) {
    case 'logo':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M8 13.5c1.2 1.6 2.4 2.4 4 2.4s2.8-.8 4-2.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="9" cy="10" r="1.2" fill="currentColor" />
          <circle cx="15" cy="10" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'main':
      return (
        <svg {...common}>
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V21M9 21h6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'speaker':
      return (
        <svg {...common}>
          <path
            d="M4 9.5v5h3.2L12 18.5V5.5L7.2 9.5H4Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M15 9.2a3.2 3.2 0 0 1 0 5.6M17.5 7a5.5 5.5 0 0 1 0 10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'flask':
      return (
        <svg {...common}>
          <path
            d="M9 3h6M10 3v6.2L5.8 18.5A2.2 2.2 0 0 0 7.8 21.5h8.4a2.2 2.2 0 0 0 2-3L14 9.2V3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8.2 15.5h7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
