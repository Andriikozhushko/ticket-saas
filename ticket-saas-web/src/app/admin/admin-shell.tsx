"use client";

import { useState, ReactNode } from "react";
import AdminMobileNav from "./admin-mobile-nav";

type AdminShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export default function AdminShell({ sidebar, children }: AdminShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="admin-layout">
      <header className="admin-mobile-header" aria-hidden="false">
        <button
          type="button"
          className="admin-mobile-burger"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Р—Р°РєСЂРёС‚Рё РјРµню" : "Р’С–РґРєСЂРёС‚Рё РјРµню"}
          aria-expanded={open}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
        <span className="admin-mobile-title">Lizard.red В· РђРґРјС–РЅ</span>
      </header>
      {open && (
        <div
          className="admin-sidebar-overlay"
          role="button"
          tabIndex={0}
          aria-label="Р—Р°РєСЂРёС‚Рё РјРµню"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === "Enter" && setOpen(false)}
        />
      )}
      <aside
        className={`admin-sidebar ${open ? "admin-sidebar-open" : ""}`}
        onClick={() => open && setOpen(false)}
      >
        {sidebar}
      </aside>
      <main className="admin-main">
        {children}
      </main>
      <AdminMobileNav />
    </div>
  );
}

