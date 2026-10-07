import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, Check, ChevronDown, Loader2, X } from "lucide-react";

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {!small && (
        <span>
          khami<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`button button-${variant} ${className}`}
    >
      {loading && <Loader2 size={16} className="spin" />}
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "gray" | "blue";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Modal({
  children,
  title,
  subtitle,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab" || !dialog.current) return;
      const all = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ),
      ].filter((el) => el.offsetParent !== null);
      const first = all[0];
      const last = all[all.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        last.focus();
        event.preventDefault();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        first.focus();
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Select({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`select-wrap ${className}`}>
      <select {...props}>{children}</select>
      <ChevronDown size={15} />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Sparkline({ variant = 0 }: { variant?: number }) {
  const paths = [
    "M2 29 L11 26 L18 31 L26 20 L34 23 L42 14 L50 18 L58 8 L66 13 L74 6 L82 10 L92 3",
    "M2 31 L12 28 L21 30 L30 22 L39 24 L48 16 L57 20 L66 12 L75 15 L84 7 L94 8",
    "M2 27 L10 31 L19 22 L28 24 L37 17 L46 22 L55 12 L64 16 L73 9 L82 13 L93 5",
    "M2 25 L13 25 L22 20 L33 20 L43 17 L54 17 L64 10 L75 10 L85 5 L94 5",
  ];
  return (
    <svg
      className="sparkline"
      viewBox="0 0 96 36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={paths[variant % 4]}
        stroke="#78a68a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StepCheck({
  active,
  complete,
  number,
}: {
  active: boolean;
  complete: boolean;
  number: number;
}) {
  return (
    <span
      className={`step-check ${active ? "active" : ""} ${complete ? "complete" : ""}`}
    >
      {complete ? <Check size={14} /> : number}
    </span>
  );
}

export function Trend({ children }: { children: ReactNode }) {
  return (
    <span className="trend">
      <ArrowUpRight size={13} />
      {children}
    </span>
  );
}
