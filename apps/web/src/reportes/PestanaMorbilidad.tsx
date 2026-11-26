import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';

import { type FiltrosAplicados, useMorbilidad } from '../lib/consultas-reportes';
import { EstadoReporte } from './comunes';
import { textoPorcentaje } from './formatos';

/** Morbilidad CIE-10: ranking (solo atenciones primeras) con barra horizontal de %. */
export function PestanaMorbilidad({ filtros }: { filtros: FiltrosAplicados }) {
  const consulta = useMorbilidad(filtros);
  const datos = consulta.data;

  return (
    <section aria-label="Morbilidad CIE-10">
      <h2 className="smo-reporte__titulo">
        Estadísticas y morbilidad CIE-10 · {datos?.periodo ?? filtros.anio}
      </h2>
      <p className="smo-ayuda">
        Cuenta solo las atenciones primeras (cada caso una vez), por diagnóstico principal.
      </p>
      <EstadoReporte
        cargando={consulta.isPending}
        error={consulta.isError}
        vacio={!datos || datos.totalPrimeras === 0}
        onReintentar={() => void consulta.refetch()}
        columnas={6}
      >
        {datos && (
          <div className="smo-tabla-desplazable">
            <Table size="sm" aria-label="Ranking de morbilidad CIE-10">
              <TableHead>
                <TableRow>
                  {[
                    'N°',
                    'Código',
                    'Descripción',
                    'Total casos',
                    '% del total',
                    'Tratamiento/medicamento más frecuente',
                  ].map((e) => (
                    <TableHeader key={e}>{e}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {datos.filas.map((f, i) => (
                  <TableRow key={f.codigo}>
                    <TableCell className="smo-numero">{i + 1}</TableCell>
                    <TableCell>
                      <strong>{f.codigo}</strong>
                    </TableCell>
                    <TableCell>{f.descripcion}</TableCell>
                    <TableCell className="smo-numero">{f.casos}</TableCell>
                    <TableCell>
                      <div className="smo-barra-porcentaje">
                        <span
                          className="smo-barra-porcentaje__relleno"
                          style={{ inlineSize: `${f.porcentaje ?? 0}%` }}
                          aria-hidden="true"
                        />
                        <span className="smo-barra-porcentaje__texto">
                          {textoPorcentaje(f.porcentaje)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{f.tratamiento}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="smo-fila-total">
                  <TableCell />
                  <TableCell />
                  <TableCell>Total de atenciones primeras</TableCell>
                  <TableCell className="smo-numero">{datos.totalPrimeras}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </EstadoReporte>
    </section>
  );
}
