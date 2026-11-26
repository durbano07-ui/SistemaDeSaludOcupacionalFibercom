import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { NOMBRES_MES, type Totales } from '@smo/shared';

import { Grafico } from '../componentes/graficos/Grafico';
import { type FiltrosAplicados, useConsolidadoAnual } from '../lib/consultas-reportes';
import { EstadoReporte } from './comunes';

const COLUMNAS: [string, keyof Totales][] = [
  ['Total atenciones', 'total'],
  ['Enfermedad común', 'enfermedadComun'],
  ['Enfermedad profesional', 'enfermedadProfesional'],
  ['Incidentes', 'incidentes'],
  ['Accidentes', 'accidentes'],
  ['Primera vez', 'primera'],
  ['Subsecuente', 'subsecuente'],
];

const SERIES: [string, keyof Totales][] = [
  ['Enfermedad común', 'enfermedadComun'],
  ['Enfermedad profesional', 'enfermedadProfesional'],
  ['Accidente de trabajo', 'accidentes'],
  ['Incidente de trabajo', 'incidentes'],
];

/** Consolidado anual: 12 meses + totales y barras apiladas por tipo de evento. */
export function PestanaConsolidado({ filtros }: { filtros: FiltrosAplicados }) {
  const consulta = useConsolidadoAnual(filtros);
  const datos = consulta.data;

  return (
    <section aria-label="Consolidado anual">
      <h2 className="smo-reporte__titulo">Consolidado anual de atenciones · {filtros.anio}</h2>
      <EstadoReporte
        cargando={consulta.isPending}
        error={consulta.isError}
        vacio={!datos || datos.totales.total === 0}
        onReintentar={() => void consulta.refetch()}
        columnas={8}
      >
        {datos && (
          <>
            <div className="smo-tabla-desplazable">
              <Table size="sm" aria-label="Consolidado anual por mes">
                <TableHead>
                  <TableRow>
                    <TableHeader>Mes</TableHeader>
                    {COLUMNAS.map(([t]) => (
                      <TableHeader key={t}>{t}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {datos.meses.map((m) => (
                    <TableRow key={m.mes}>
                      <TableCell>{NOMBRES_MES[m.mes - 1]}</TableCell>
                      {COLUMNAS.map(([, c]) => (
                        <TableCell key={c} className="smo-numero">
                          {m[c]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow className="smo-fila-total">
                    <TableCell>TOTAL</TableCell>
                    {COLUMNAS.map(([, c]) => (
                      <TableCell key={c} className="smo-numero">
                        {datos.totales[c]}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <Grafico
              titulo="Atenciones por mes y tipo de evento"
              tipo="barras-apiladas"
              datos={datos.meses.flatMap((m) =>
                SERIES.map(([grupo, campo]) => ({
                  grupo,
                  clave: NOMBRES_MES[m.mes - 1]!.slice(0, 3),
                  valor: m[campo],
                })),
              )}
              tabla={{
                encabezados: ['Mes', ...SERIES.map(([g]) => g)],
                filas: datos.meses.map((m) => [
                  NOMBRES_MES[m.mes - 1]!,
                  ...SERIES.map(([, c]) => m[c]),
                ]),
              }}
            />
          </>
        )}
      </EstadoReporte>
    </section>
  );
}
