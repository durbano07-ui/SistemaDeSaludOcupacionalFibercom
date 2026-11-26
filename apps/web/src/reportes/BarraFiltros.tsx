import { DocumentPdf, Filter, Xls } from '@carbon/icons-react';
import { Button, InlineLoading, Select, SelectItem } from '@carbon/react';
import { NOMBRES_MES } from '@smo/shared';

import type { FiltrosAplicados } from '../lib/consultas-reportes';
import { useOpcionesReporte } from '../lib/consultas-reportes';

export type PeriodoReporte = 'mes' | 'trimestre' | 'mes-o-trimestre' | 'anio';

interface BarraFiltrosProps {
  borrador: FiltrosAplicados;
  onCambiar: (filtros: FiltrosAplicados) => void;
  onAplicar: () => void;
  periodo: PeriodoReporte;
  anios: number[];
  /** null: el reporte no se exporta (Estadísticas de gestión). */
  onExportar: ((formato: 'excel' | 'pdf') => void) | null;
  exportando: 'excel' | 'pdf' | null;
}

const numero = (valor: string) => (valor === '' ? undefined : Number(valor));

/** Año, mes o trimestre según el reporte, base y cargo; "Aplicar" y exportaciones. */
export function BarraFiltros({
  borrador,
  onCambiar,
  onAplicar,
  periodo,
  anios,
  onExportar,
  exportando,
}: BarraFiltrosProps) {
  const opciones = useOpcionesReporte();
  const cambiar = (cambios: Partial<FiltrosAplicados>) => onCambiar({ ...borrador, ...cambios });

  return (
    <form
      className="smo-filtros"
      aria-label="Filtros del reporte"
      onSubmit={(evento) => {
        evento.preventDefault();
        onAplicar();
      }}
    >
      <div className="smo-filtros__campos">
        <Select
          id="filtro-anio"
          labelText="Año"
          value={String(borrador.anio)}
          onChange={(e) => cambiar({ anio: Number(e.target.value) })}
        >
          {anios.map((a) => (
            <SelectItem key={a} value={String(a)} text={String(a)} />
          ))}
        </Select>

        {(periodo === 'mes' || periodo === 'mes-o-trimestre') && (
          <Select
            id="filtro-mes"
            labelText="Mes"
            value={borrador.mes === undefined ? '' : String(borrador.mes)}
            onChange={(e) =>
              cambiar({
                mes: numero(e.target.value),
                ...(e.target.value ? { trimestre: undefined } : {}),
              })
            }
          >
            {periodo === 'mes-o-trimestre' && <SelectItem value="" text="Todo el año" />}
            {NOMBRES_MES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)} text={m} />
            ))}
          </Select>
        )}

        {(periodo === 'trimestre' || periodo === 'mes-o-trimestre') && (
          <Select
            id="filtro-trimestre"
            labelText="Trimestre"
            value={borrador.trimestre === undefined ? '' : String(borrador.trimestre)}
            onChange={(e) =>
              cambiar({
                trimestre: numero(e.target.value),
                ...(e.target.value ? { mes: undefined } : {}),
              })
            }
          >
            <SelectItem value="" text={periodo === 'trimestre' ? 'Los 4 trimestres' : 'Todos'} />
            {[1, 2, 3, 4].map((t) => (
              <SelectItem key={t} value={String(t)} text={`Trimestre ${t}`} />
            ))}
          </Select>
        )}

        <Select
          id="filtro-base"
          labelText="Base"
          value={borrador.base === undefined ? '' : String(borrador.base)}
          onChange={(e) => cambiar({ base: numero(e.target.value) })}
        >
          <SelectItem value="" text="Todas" />
          {(opciones.data?.bases ?? []).map((b) => (
            <SelectItem key={b.id} value={String(b.id)} text={b.nombre} />
          ))}
        </Select>

        <Select
          id="filtro-cargo"
          labelText="Cargo"
          value={borrador.cargo === undefined ? '' : String(borrador.cargo)}
          onChange={(e) => cambiar({ cargo: numero(e.target.value) })}
        >
          <SelectItem value="" text="Todos" />
          {(opciones.data?.cargos ?? []).map((c) => (
            <SelectItem key={c.id} value={String(c.id)} text={c.nombre} />
          ))}
        </Select>

        <Button type="submit" kind="primary" renderIcon={Filter}>
          Aplicar
        </Button>
      </div>

      {onExportar && (
        <div className="smo-filtros__exportar">
          <Button
            kind="tertiary"
            renderIcon={exportando === 'excel' ? undefined : Xls}
            disabled={exportando !== null}
            onClick={() => onExportar('excel')}
          >
            {exportando === 'excel' ? <InlineLoading description="Generando…" /> : 'Exportar Excel'}
          </Button>
          <Button
            kind="tertiary"
            renderIcon={exportando === 'pdf' ? undefined : DocumentPdf}
            disabled={exportando !== null}
            onClick={() => onExportar('pdf')}
          >
            {exportando === 'pdf' ? <InlineLoading description="Generando…" /> : 'Exportar PDF'}
          </Button>
        </div>
      )}
    </form>
  );
}
