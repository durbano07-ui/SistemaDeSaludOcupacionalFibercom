import { Report, UserMultiple } from '@carbon/icons-react';
import {
  Button,
  InlineNotification,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tile,
} from '@carbon/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { descargar, ErrorApi } from '../lib/api';
import { consulta, type FiltrosAplicados } from '../lib/consultas-reportes';
import { dayjs, ZONA_HORARIA } from '../lib/fecha';
import { BarraFiltros, type PeriodoReporte } from './BarraFiltros';
import { PestanaConsolidado } from './PestanaConsolidado';
import { PestanaGestion } from './PestanaGestion';
import { PestanaMorbilidad } from './PestanaMorbilidad';
import { PestanaRegistro } from './PestanaRegistro';
import { PestanaTrimestral } from './PestanaTrimestral';

interface DefinicionPestana {
  nombre: string;
  periodo: PeriodoReporte;
  /** Ruta de exportación (null: no se exporta). */
  exportable: string | null;
  /** Filtros que usa el reporte (para la exportación). */
  parametros: (f: FiltrosAplicados) => Record<string, number | undefined>;
}

const PESTANAS: DefinicionPestana[] = [
  {
    nombre: 'Registro mensual',
    periodo: 'mes',
    exportable: 'registro-mensual',
    parametros: ({ anio, mes, base, cargo }) => ({ anio, mes, base, cargo }),
  },
  {
    nombre: 'Consolidado anual',
    periodo: 'anio',
    exportable: 'consolidado-anual',
    parametros: ({ anio, base, cargo }) => ({ anio, base, cargo }),
  },
  {
    nombre: 'Informe trimestral SST',
    periodo: 'trimestre',
    exportable: 'informe-trimestral',
    parametros: ({ anio, trimestre, base, cargo }) => ({ anio, trimestre, base, cargo }),
  },
  {
    nombre: 'Morbilidad CIE-10',
    periodo: 'mes-o-trimestre',
    exportable: 'morbilidad',
    parametros: ({ anio, mes, trimestre, base, cargo }) => ({ anio, mes, trimestre, base, cargo }),
  },
  {
    nombre: 'Estadísticas de gestión',
    periodo: 'anio',
    exportable: null,
    parametros: ({ anio, base, cargo }) => ({ anio, base, cargo }),
  },
];

/** El filtro de período de cada pestaña: el mes solo aplica a registro y morbilidad, etc. */
function filtrosDePestana(
  f: FiltrosAplicados,
  periodo: PeriodoReporte,
  mesActual: number,
): FiltrosAplicados {
  switch (periodo) {
    case 'mes':
      return { ...f, mes: f.mes ?? mesActual, trimestre: undefined };
    case 'trimestre':
      return { ...f, mes: undefined };
    case 'anio':
      return { ...f, mes: undefined, trimestre: undefined };
    default:
      return f;
  }
}

/** Pantalla Reportes del médico (/medico/reportes). Se carga de forma perezosa. */
export default function PantallaReportes() {
  const navegar = useNavigate();
  const hoy = dayjs().tz(ZONA_HORARIA);
  const anios = Array.from({ length: 5 }, (_, i) => hoy.year() - i);
  const mesActual = hoy.month() + 1;

  const [pestana, setPestana] = useState(0);
  const [borrador, setBorrador] = useState<FiltrosAplicados>({ anio: hoy.year(), mes: mesActual });
  const [aplicados, setAplicados] = useState<FiltrosAplicados>(borrador);
  const [exportando, setExportando] = useState<'excel' | 'pdf' | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const definicion = PESTANAS[pestana]!;
  const filtros = filtrosDePestana(aplicados, definicion.periodo, mesActual);

  const exportar = async (formato: 'excel' | 'pdf') => {
    if (!definicion.exportable) return;
    setExportando(formato);
    setAviso(null);
    try {
      const nombre = await descargar(
        `/reportes/${definicion.exportable}/${formato}?${consulta(definicion.parametros(filtros))}`,
      );
      setAviso({ tipo: 'success', texto: `Se descargó ${nombre}.` });
    } catch (error) {
      setAviso({
        tipo: 'error',
        texto:
          error instanceof ErrorApi
            ? (error.detalle ?? error.titulo)
            : 'No se pudo generar el archivo. Inténtalo de nuevo.',
      });
    } finally {
      setExportando(null);
    }
  };

  return (
    <div className="smo-reportes">
      <Tile className="smo-contenedor smo-acciones">
        <Button kind="tertiary" renderIcon={UserMultiple} onClick={() => void navegar('/medico')}>
          Pacientes
        </Button>
        <Button renderIcon={Report} aria-current="page">
          Reportes
        </Button>
      </Tile>

      <Tile className="smo-contenedor smo-pestanas">
        <Tabs
          selectedIndex={pestana}
          onChange={({ selectedIndex }) => {
            setPestana(selectedIndex);
            setAviso(null);
            setBorrador(filtrosDePestana(aplicados, PESTANAS[selectedIndex]!.periodo, mesActual));
          }}
        >
          <TabList aria-label="Reportes" contained={false}>
            {PESTANAS.map((p) => (
              <Tab key={p.nombre}>{p.nombre}</Tab>
            ))}
          </TabList>

          <BarraFiltros
            borrador={filtrosDePestana(borrador, definicion.periodo, mesActual)}
            onCambiar={setBorrador}
            onAplicar={() => setAplicados(borrador)}
            periodo={definicion.periodo}
            anios={anios}
            onExportar={definicion.exportable ? (f) => void exportar(f) : null}
            exportando={exportando}
          />
          {aviso && (
            <InlineNotification
              kind={aviso.tipo}
              lowContrast
              role={aviso.tipo === 'error' ? 'alert' : 'status'}
              title={aviso.tipo === 'error' ? 'No se pudo exportar' : 'Exportación lista'}
              subtitle={aviso.texto}
              onClose={() => setAviso(null)}
            />
          )}

          <TabPanels>
            <TabPanel>{pestana === 0 && <PestanaRegistro filtros={filtros} />}</TabPanel>
            <TabPanel>{pestana === 1 && <PestanaConsolidado filtros={filtros} />}</TabPanel>
            <TabPanel>{pestana === 2 && <PestanaTrimestral filtros={filtros} />}</TabPanel>
            <TabPanel>{pestana === 3 && <PestanaMorbilidad filtros={filtros} />}</TabPanel>
            <TabPanel>{pestana === 4 && <PestanaGestion filtros={filtros} />}</TabPanel>
          </TabPanels>
        </Tabs>
      </Tile>
    </div>
  );
}
