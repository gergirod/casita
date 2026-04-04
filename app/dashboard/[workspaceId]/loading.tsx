import { CasitaLogo } from "@/components/casita-logo";

export default function WorkspaceLoading() {
  return (
    <main className="page-shell">
      <div className="casita-loading-shell">
        <div className="casita-loading-card">
          <div className="casita-loader-mark" aria-hidden="true">
            <CasitaLogo size={24} variant="nav" />
          </div>
          <p className="casita-loading-title">Abriendo tu casita</p>
          <p className="casita-loading-subtitle">Estamos cargando el estado del mes</p>
          <div className="casita-loading-dots" aria-hidden="true">
            <span className="casita-loading-dot" />
            <span className="casita-loading-dot" />
            <span className="casita-loading-dot" />
          </div>
        </div>
      </div>
    </main>
  );
}
