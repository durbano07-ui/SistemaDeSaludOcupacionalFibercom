import '@carbon/charts-react/styles.css';

import { DonutChart, LineChart, SimpleBarChart, StackedBarChart } from '@carbon/charts-react';

import { escalaColores } from './paleta';

export type TipoGrafico = 'barras' | 'barras-apiladas' | 'barras-horizontales' | 'dona' | 'linea';

export interface DatoGrafico {
  grupo: string;
  /** Categoría del eje (mes, CIE-10…) o fecha ISO en los de línea. */
  clave: string;
  valor: number | null;
}

export interface GraficoCarbonProps {
  tipo: TipoGrafico;
  datos: DatoGrafico[];
  /** Título del eje de valores. */
  ejeValores?: string;
  alto?: string;
}

/** Gráficos de Carbon con la paleta FIBERCOM. Se carga de forma perezosa (ver Grafico.tsx). */
export default function GraficoCarbon({
  tipo,
  datos,
  ejeValores = 'Atenciones',
  alto = '300px',
}: GraficoCarbonProps) {
  const grupos = [...new Set(datos.map((d) => d.grupo))];
  const data = datos.map((d) =>
    tipo === 'linea'
      ? { group: d.grupo, date: new Date(d.clave), value: d.valor }
      : { group: d.grupo, key: d.clave, value: d.valor },
  );
  const comunes = {
    height: alto,
    theme: 'white' as never,
    toolbar: { enabled: false },
    color: { scale: escalaColores(grupos) },
    legend: { enabled: grupos.length > 1 || tipo === 'dona' },
    accessibility: { svgAriaLabel: ejeValores },
  };

  switch (tipo) {
    case 'dona':
      return (
        <DonutChart
          data={data}
          options={{
            ...comunes,
            resizable: true,
            donut: { center: { label: ejeValores } },
            pie: { alignment: 'center' as never },
          }}
        />
      );
    case 'linea':
      return (
        <LineChart
          data={data}
          options={{
            ...comunes,
            axes: {
              bottom: { mapsTo: 'date', scaleType: 'time' as never },
              left: { mapsTo: 'value', title: ejeValores },
            },
            curve: 'curveMonotoneX',
            points: { radius: 2 },
          }}
        />
      );
    case 'barras-horizontales':
      return (
        <SimpleBarChart
          data={data}
          options={{
            ...comunes,
            axes: {
              left: { mapsTo: 'key', scaleType: 'labels' as never },
              bottom: { mapsTo: 'value', title: ejeValores },
            },
          }}
        />
      );
    case 'barras-apiladas':
      return (
        <StackedBarChart
          data={data}
          options={{
            ...comunes,
            axes: {
              bottom: { mapsTo: 'key', scaleType: 'labels' as never },
              left: { mapsTo: 'value', stacked: true, title: ejeValores },
            },
          }}
        />
      );
    default:
      return (
        <SimpleBarChart
          data={data}
          options={{
            ...comunes,
            axes: {
              bottom: { mapsTo: 'key', scaleType: 'labels' as never },
              left: { mapsTo: 'value', title: ejeValores },
            },
          }}
        />
      );
  }
}
