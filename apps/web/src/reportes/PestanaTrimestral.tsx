import { Edit } from '@carbon/icons-react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { NOMBRES_INDICADOR_SST, NOMBRES_MES } from '@smo/shared';
import { useState } from 'react';

import { type FiltrosAplicados, useInformeTrimestral } from '../lib/consultas-reportes';
import { CeldaCumple, EstadoReporte } from './comunes';
import { textoPorcentaje } from './formatos';
import { ModalMetas } from './ModalMetas';

/** Informe trimestral SST: por trimestre, con Meta SST y Cumple; "Editar metas". */
export function PestanaTrimestral({ filtros }: { filtros: FiltrosAplicados }) {
  const consulta = useInformeTrimestral(filtros);
  const [editando, setEditando] = useState(false);
  const datos = consulta.data;
  const total = datos?.trimestres.reduce(
    (s, t) => s + (t.filas.find((f) => f.indicador === 'total_atenciones')?.total ?? 0),
    0,
  );

  return (
    <section aria-label="Informe trimestral SST">
      <div className="smo-reporte__barra">
        <h2 className="smo-reporte__titulo">
          Informes trimestrales de indicadores SST · {filtros.anio}
        </h2>
        <Button kind="tertiary" size="sm" renderIcon={Edit} onClick={() => setEditando(true)}>
          Editar metas
        </Button>
      </div>
      <EstadoReporte
        cargando={consulta.isPending}
        error={consulta.isError}
        vacio={!datos || total === 0}
        onReintentar={() => void consulta.refetch()}
        columnas={8}
      >
        {datos?.trimestres.map((t) => {
          const [m1, m2, m3] = t.meses.map((m) => NOMBRES_MES[m - 1]!);
          return (
            <div key={t.trimestre} className="smo-trimestre">
              <h3>
                Trimestre {t.trimestre} ({m1} – {m3})
              </h3>
              <div className="smo-tabla-desplazable">
                <Table size="sm" aria-label={`Trimestre ${t.trimestre}`}>
                  <TableHead>
                    <TableRow>
                      {[
                        'Indicador',
                        m1!,
                        m2!,
                        m3!,
                        'Total trimestre',
                        '% del total',
                        'Meta SST',
                        'Cumple',
                      ].map((e) => (
                        <TableHeader key={e}>{e}</TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {t.filas.map((f) => (
                      <TableRow
                        key={f.indicador}
                        className={
                          f.indicador === 'total_atenciones' ? 'smo-fila-total' : undefined
                        }
                      >
                        <TableCell>{NOMBRES_INDICADOR_SST[f.indicador]}</TableCell>
                        {f.valores.map((v, i) => (
                          <TableCell key={i} className="smo-numero">
                            {v}
                          </TableCell>
                        ))}
                        <TableCell className="smo-numero">{f.total}</TableCell>
                        <TableCell className="smo-numero">
                          {textoPorcentaje(f.porcentaje)}
                        </TableCell>
                        <TableCell>{f.meta ?? '—'}</TableCell>
                        <TableCell>
                          <CeldaCumple cumple={f.cumple} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
      </EstadoReporte>
      {editando && <ModalMetas onCerrar={() => setEditando(false)} />}
    </section>
  );
}
