import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { NOMBRES_MES, type Totales } from '@smo/shared';
import { useState } from 'react';

import { type FiltrosAplicados, useRegistroMensual } from '../lib/consultas-reportes';
import { formatearFecha } from '../lib/fecha';
import { EstadoReporte } from './comunes';

const TAMANO = 20;
const TARJETAS: [string, keyof Totales][] = [
  ['Total atenciones', 'total'],
  ['Enfermedad común', 'enfermedadComun'],
  ['Incidentes', 'incidentes'],
  ['Accidentes', 'accidentes'],
  ['Primera vez', 'primera'],
  ['Subsecuente', 'subsecuente'],
];

/** Registro mensual: 6 totales del mes y la lista (columnas del Excel, sin Firma), de 20 en 20. */
export function PestanaRegistro({ filtros }: { filtros: FiltrosAplicados }) {
  const consulta = useRegistroMensual(filtros);
  const [pagina, setPagina] = useState(1);
  const mes = consulta.data?.meses[0];
  const filas = mes?.filas ?? [];
  const paginas = Math.max(1, Math.ceil(filas.length / TAMANO));
  const actual = Math.min(pagina, paginas);
  const visibles = filas.slice((actual - 1) * TAMANO, actual * TAMANO);

  return (
    <section aria-label="Registro mensual">
      <h2 className="smo-reporte__titulo">
        Registro de atenciones · {NOMBRES_MES[(filtros.mes ?? 1) - 1]} {filtros.anio}
      </h2>
      <EstadoReporte
        cargando={consulta.isPending}
        error={consulta.isError}
        vacio={!mes || mes.totales.total === 0}
        onReintentar={() => void consulta.refetch()}
        columnas={9}
      >
        {mes && (
          <>
            <div className="smo-tarjetas-totales">
              {TARJETAS.map(([titulo, campo]) => (
                <Tile key={campo} className="smo-tarjeta-total">
                  <span>{titulo}</span>
                  <strong>{mes.totales[campo]}</strong>
                </Tile>
              ))}
            </div>
            <div className="smo-tabla-desplazable">
              <Table size="sm" aria-label="Registro de atenciones del mes">
                <TableHead>
                  <TableRow>
                    {[
                      'Fecha de atención',
                      'Nombre del paciente',
                      'Tipo de evento',
                      'Cédula',
                      'Cargo/Puesto',
                      'Código CIE-10',
                      'Tipo de atención',
                      'Medicamento usado/dosificación',
                      'Observaciones/indicaciones',
                    ].map((t) => (
                      <TableHeader key={t}>{t}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibles.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{formatearFecha(f.fecha)}</TableCell>
                      <TableCell>{f.paciente}</TableCell>
                      <TableCell>{f.tipoEvento}</TableCell>
                      <TableCell>{f.cedula}</TableCell>
                      <TableCell>{f.cargo}</TableCell>
                      <TableCell>{f.cie10}</TableCell>
                      <TableCell>{f.tipoAtencion}</TableCell>
                      <TableCell>{f.medicamentos}</TableCell>
                      <TableCell>{f.observaciones}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <nav className="smo-paginacion" aria-label="Paginación del registro mensual">
              <span aria-live="polite">
                {(actual - 1) * TAMANO + 1}–{Math.min(actual * TAMANO, filas.length)} de{' '}
                {filas.length}
              </span>
              <Button
                kind="ghost"
                size="sm"
                disabled={actual === 1}
                onClick={() => setPagina(actual - 1)}
              >
                Anterior
              </Button>
              <Button
                kind="ghost"
                size="sm"
                disabled={actual === paginas}
                onClick={() => setPagina(actual + 1)}
              >
                Siguiente
              </Button>
            </nav>
          </>
        )}
      </EstadoReporte>
    </section>
  );
}
