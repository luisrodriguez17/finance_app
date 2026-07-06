import type { ReactNode } from 'react';

/** Compact list row that expands on tap to reveal editing controls. */
export function EntryItem({
  open,
  onToggle,
  info,
  side,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  info: ReactNode;
  side?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`entry-item ${open ? 'open' : ''}`}>
      <div className="entry-head" onClick={onToggle}>
        <div className="entry-info">{info}</div>
        {side && <div className="entry-side">{side}</div>}
        <Chevron />
      </div>
      {open && <div className="entry-body">{children}</div>}
    </div>
  );
}

function Chevron() {
  return (
    <svg className="chevron" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** A `.section` card whose body collapses behind a tappable title + summary. */
export function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="section">
      <div className={`section-head ${open ? 'open' : ''}`} onClick={onToggle}>
        <div className="entry-info">
          <h3>{title}</h3>
          {summary && <div className="entry-meta">{summary}</div>}
        </div>
        <Chevron />
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

/** Labeled form control. Uses a div (not label) so composite children with buttons behave. */
export function Field({
  label,
  span2,
  children,
}: {
  label: ReactNode;
  span2?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`field ${span2 ? 'span-2' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

/** Full-width dashed button that reveals/hides an add-form. */
export function AddToggle({
  open,
  label,
  onClick,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`add-toggle ${open ? 'open' : ''}`} onClick={onClick}>
      {open ? '−' : '+'} {label}
    </button>
  );
}
