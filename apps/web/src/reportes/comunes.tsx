import { CheckmarkFilled, ErrorFilled } from '@carbon/icons-react';
import { Button, DataTableSkeleton, InlineNotification } from '@carbon/react';
import type { ReactNode } from 'react';

/** Esqueleto mientras carga un reporte. */
export function CargandoReporte({ columnas = 6 }: { columnas?: number }) {
  return (
    <DataTableSkeleton columnCount={columnas} rowCount={6} showHeader={false} showToolbar={false} />
  );
}

export function ErrorReporte({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="smo-reporte-error">
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title="No se pudo cargar el reporte"
        subtitle="Revisa tu conexión e inténtalo de nuevo."
      />
      <Button kind="tertiary" size="sm" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}

export function SinDatos() {
  return <p className="smo-vacio">Sin atenciones en el período</p>;
}

/** Estado común de una consulta de reporte: cargando, error, vacío o contenido. */
export function EstadoReporte({
  cargando,
  error,
  vacio,
  onReintentar,
  columnas,
  children,
}: {
  cargando: boolean;
  error: boolean;
  vacio: boolean;
  onReintentar: () => void;
  columnas?: number;
  children: ReactNode;
}) {
  if (cargando) return <CargandoReporte columnas={columnas} />;
  if (error) return <ErrorReporte onReintentar={onReintentar} />;
  if (vacio) return <SinDatos />;
  return children;
}

/** "Cumple" con ícono y texto (nunca solo color). */
export function CeldaCumple({ cumple }: { cumple: 'si' | 'no' | null }) {
  if (cumple === 'si') {
    return (
      <span className="smo-cumple smo-cumple--si">
        <CheckmarkFilled size={16} aria-hidden="true" /> Sí
      </span>
    );
  }
  if (cumple === 'no') {
    return (
      <span className="smo-cumple smo-cumple--no">
        <ErrorFilled size={16} aria-hidden="true" /> No
      </span>
    );
  }
  return <span aria-label="No aplica">—</span>;
}
