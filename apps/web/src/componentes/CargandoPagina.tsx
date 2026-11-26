import { Loading } from '@carbon/react';

/** Mientras se descarga una página que se carga de forma perezosa. */
export function CargandoPagina() {
  return (
    <div className="smo-cargando-pagina">
      <Loading withOverlay={false} small description="Cargando…" />
    </div>
  );
}
