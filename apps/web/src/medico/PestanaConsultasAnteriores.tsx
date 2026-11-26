import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { TAMANO_PAGINA_HISTORIAL } from '@smo/shared';
import { useState } from 'react';

import { useHistorial } from '../lib/consultas-medico';
import { TablaAtenciones } from './TablaAtenciones';

/** Todas las atenciones del paciente, de la más reciente a la más antigua, de 10 en 10. */
export function PestanaConsultasAnteriores({ idPaciente }: { idPaciente: number }) {
  const [pagina, setPagina] = useState(1);
  const consulta = useHistorial(idPaciente, pagina);

  if (consulta.isPending) return <InlineLoading description="Cargando consultas…" />;
  if (consulta.isError) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title="No se pudieron cargar las consultas"
        subtitle="Inténtalo de nuevo."
      />
    );
  }

  const { total, atenciones } = consulta.data;
  if (total === 0) return <p className="smo-vacio">El paciente no tiene consultas anteriores.</p>;

  const desde = (pagina - 1) * TAMANO_PAGINA_HISTORIAL + 1;
  const hasta = Math.min(pagina * TAMANO_PAGINA_HISTORIAL, total);

  return (
    <>
      <TablaAtenciones atenciones={atenciones} etiqueta="Consultas anteriores" conFecha />
      <nav className="smo-paginacion" aria-label="Paginación de consultas anteriores">
        <span aria-live="polite">
          {desde}–{hasta} de {total}
        </span>
        <Button
          kind="ghost"
          size="sm"
          disabled={pagina === 1 || consulta.isPlaceholderData}
          onClick={() => setPagina((p) => p - 1)}
        >
          Anterior
        </Button>
        <Button
          kind="ghost"
          size="sm"
          disabled={hasta >= total || consulta.isPlaceholderData}
          onClick={() => setPagina((p) => p + 1)}
        >
          Siguiente
        </Button>
      </nav>
    </>
  );
}
