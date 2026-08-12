import type { ReactNode } from "react";

export function AuthShell({ titulo, sub, children }: { titulo: string; sub: string; children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-mark">C</div>
        <h1 className="auth-title">{titulo}</h1>
        <p className="auth-sub">{sub}</p>
        {children}
        <div className="auth-foot">Casinha do Marketing · Seahub</div>
      </div>
    </div>
  );
}
