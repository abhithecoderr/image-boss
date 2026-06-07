import React from 'react';

/**
 * ServiceIcon
 * A centralized, universal icon component rendering premium aesthetic vector SVGs.
 * Maps service IDs to their corresponding SVG representations.
 */
export default function ServiceIcon({ id, className = '', ...props }) {
  const baseProps = {
    width: '100%',
    height: '100%',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.75',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    ...props
  };

  switch (id) {
    case 'background-removal':
      return (
        <svg {...baseProps}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <line x1="9.8" y1="8.2" x2="20" y2="18" />
          <line x1="9.8" y1="15.8" x2="20" y2="6" />
        </svg>
      );

    case 'magic-erase':
      return (
        <svg {...baseProps}>
          <path d="m15 4-2 2L18 11l2-2a2.82 2.82 0 0 0-4-4Z" />
          <path d="M11 8 3 16v5h5l8-8" />
          <path d="M19 16v6" />
          <path d="M16 19h6" />
          <path d="M12 2v2" />
          <path d="M5 5v2" />
        </svg>
      );

    case 'object-segmentation':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
        </svg>
      );

    case 'upscaling':
      return (
        <svg {...baseProps}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      );

    case 'blur':
      return (
        <svg {...baseProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <circle cx="12" cy="11" r="3" />
          <path d="M7 16c0-2.5 3-4.5 5-4.5s5 2 5 4.5" />
        </svg>
      );

    case 'line-art':
      return (
        <svg {...baseProps}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );

    case 'compression':
      return (
        <svg {...baseProps}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );

    case 'file-conversion':
      return (
        <svg {...baseProps}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" style={{ opacity: 0.15 }} />
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </svg>
      );

    case 'captioning':
      return (
        <svg {...baseProps}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="16" y2="11" />
        </svg>
      );

    case 'image-editor':
      return (
        <svg {...baseProps}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );

    case 'workflows':
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="5" r="3" />
          <circle cx="5" cy="19" r="3" />
          <circle cx="19" cy="19" r="3" />
          <line x1="10" y1="7.5" x2="6.5" y2="16.5" />
          <line x1="14" y1="7.5" x2="17.5" y2="16.5" />
          <line x1="8" y1="19" x2="16" y2="19" strokeDasharray="3 3" />
        </svg>
      );

    case 'ecommerce':
      return (
        <svg {...baseProps}>
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );

    case 'real-estate':
      return (
        <svg {...baseProps}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );

    case 'social-media':
      return (
        <svg {...baseProps}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      );

    case 'creative-studios':
      return (
        <svg {...baseProps}>
          <path d="M12 22C17.52 22 22 17.52 22 12S17.52 2 12 2 2 6.48 2 12a10 10 0 0 0 10 10z" />
          <circle cx="7.5" cy="10.5" r="1.5" />
          <circle cx="11.5" cy="7.5" r="1.5" />
          <circle cx="16.5" cy="9.5" r="1.5" />
          <circle cx="15.5" cy="14.5" r="1.5" />
        </svg>
      );

    case 'privacy-redaction':
      return (
        <svg {...baseProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 11 2 2 4-4" />
        </svg>
      );

    default:
      // Fallback star / spark icon
      return (
        <svg {...baseProps}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
  }
}
