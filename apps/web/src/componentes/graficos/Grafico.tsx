import { DataTable } from '@carbon/icons-react';
import {
  Button,
  SkeletonPlaceholder,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { lazy, Suspense, useId, useState } from 'react';

import type { DatoGrafico, TipoGrafico } from './GraficoCarbon';

// La librería de gráficos (pesada) se descarga solo cuando se muestra el primer gráfico.
const GraficoCarbon = lazy(() => import('./GraficoCarbon'));

interface GraficoProps {
  titulo: string;
  tipo: TipoGrafico;
  datos: DatoGrafico[];
  ejeValores?: string;
  /** Encabezados y filas de la tabla accesible "Ver datos" (por defecto: grupo, clave, valor). */
  tabla?: { encabezados: string[]; filas: (string | number)[][] };
  alto?: string;
}

/** Gráfico con título y una tabla equivalente accesible ("Ver datos"). */
export function Grafico({ titulo, tipo, datos, ejeValores, tabla, alto }: GraficoProps) {
  const [verDatos, setVerDatos] = useState(false);
  const idTitulo = useId();
  const tablaFinal = tabla ?? {
    encabezados: ['Serie', 'Categoría', ejeValores ?? 'Valor'],
    filas: datos.map((d) => [d.grupo, d.clave, d.valor ?? '—']),
  };

  return (
    <Tile className="smo-grafico">
      <div className="smo-grafico__cabecera">
        <h3 id={idTitulo} className="smo-grafico__titulo">
          {titulo}
        </h3>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={DataTable}
          aria-expanded={verDatos}
          onClick={() => setVerDatos((v) => !v)}
        >
          {verDatos ? 'Ver gráfico' : 'Ver datos'}
        </Button>
      </div>
      {verDatos ? (
        <div className="smo-tabla-desplazable">
          <Table size="sm" aria-labelledby={idTitulo}>
            <TableHead>
              <TableRow>
                {tablaFinal.encabezados.map((e) => (
                  <TableHeader key={e}>{e}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tablaFinal.filas.map((fila, i) => (
                <TableRow key={i}>
                  {fila.map((celda, j) => (
                    <TableCell key={j}>{celda}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div role="img" aria-labelledby={idTitulo}>
          <Suspense fallback={<SkeletonPlaceholder className="smo-grafico__esqueleto" />}>
            <GraficoCarbon tipo={tipo} datos={datos} ejeValores={ejeValores} alto={alto} />
          </Suspense>
        </div>
      )}
    </Tile>
  );
}
