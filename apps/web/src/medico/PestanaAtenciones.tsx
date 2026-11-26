import { Add } from '@carbon/icons-react';
import { Button, InlineLoading, InlineNotification, Select, SelectItem } from '@carbon/react';
import type { ResumenPaciente } from '@smo/shared';
import { useState } from 'react';

import { usePermiso } from '../auth/useAuth';
import { useAtencionesMes } from '../lib/consultas-medico';
import { nombreMes, ultimosMeses } from '../lib/fecha';
import { ModalDocumento, type TipoDocumento } from './ModalDocumento';
import { TablaAtenciones } from './TablaAtenciones';

interface PestanaAtencionesProps {
  paciente: ResumenPaciente;
  onNuevaAtencion: () => void;
}

/** Atenciones del paciente en un mes (últimos 6 meses), con "Nueva atención". */
export function PestanaAtenciones({ paciente, onNuevaAtencion }: PestanaAtencionesProps) {
  const meses = ultimosMeses(6);
  const [mes, setMes] = useState(meses[0]!);
  const [documento, setDocumento] = useState<{ id: number; tipo: TipoDocumento } | null>(null);
  const puedeRegistrar = usePermiso('atenciones');
  const consulta = useAtencionesMes(paciente.id, mes);

  return (
    <>
      <div className="smo-barra">
        <Select
          id="selector-mes"
          labelText="Mes"
          inline
          value={mes}
          onChange={(evento) => setMes(evento.target.value)}
        >
          {meses.map((m) => (
            <SelectItem key={m} value={m} text={nombreMes(m)} />
          ))}
        </Select>
        {puedeRegistrar && (
          <Button renderIcon={Add} onClick={onNuevaAtencion}>
            Nueva atención
          </Button>
        )}
      </div>

      {consulta.isPending ? (
        <InlineLoading description="Cargando atenciones…" />
      ) : consulta.isError ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="No se pudieron cargar las atenciones"
          subtitle="Inténtalo de nuevo."
        />
      ) : consulta.data.atenciones.length === 0 ? (
        <p className="smo-vacio">Sin atenciones en {nombreMes(mes)}</p>
      ) : (
        <TablaAtenciones
          atenciones={consulta.data.atenciones}
          etiqueta={`Atenciones de ${nombreMes(mes)}`}
          onVer={(id, tipo) => setDocumento({ id, tipo })}
        />
      )}

      {documento && (
        <ModalDocumento
          idAtencion={documento.id}
          tipo={documento.tipo}
          onCerrar={() => setDocumento(null)}
        />
      )}
    </>
  );
}
