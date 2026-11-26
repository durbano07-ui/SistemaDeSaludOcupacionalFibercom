import { CheckmarkFilled, ErrorFilled } from '@carbon/icons-react';
import {
  ContentSwitcher,
  Heading,
  InlineNotification,
  Section,
  SkeletonText,
  Switch,
  Tile,
} from '@carbon/react';
import { useState } from 'react';

import { Grafico } from '../componentes/graficos/Grafico';
import { useModulos, useRendimiento, useUsuariosActivos } from '../lib/consultas-reportes';
import { dayjs, formatearFechaHora, ZONA_HORARIA } from '../lib/fecha';

function TarjetaIndicador({
  titulo,
  valor,
  detalle,
  cargando,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  cargando: boolean;
}) {
  return (
    <Tile className="smo-indicador">
      <span className="smo-indicador__titulo">{titulo}</span>
      {cargando ? (
        <SkeletonText heading width="40%" />
      ) : (
        <strong className="smo-indicador__valor">{valor}</strong>
      )}
      <span className="smo-indicador__detalle">{detalle}</span>
    </Tile>
  );
}

/** Estadísticas del administrador: rendimiento, usuarios activos y módulos (refresco cada 30 s). */
export default function PaginaEstadisticas() {
  const [rango, setRango] = useState<'1h' | '24h'>('1h');
  const rendimiento = useRendimiento(rango);
  const usuarios = useUsuariosActivos();
  const modulos = useModulos();
  const error = rendimiento.isError || usuarios.isError || modulos.isError;
  const hora = (iso: string) =>
    dayjs(iso)
      .tz(ZONA_HORARIA)
      .format(rango === '1h' ? 'HH:mm' : 'DD/MM HH:mm');

  return (
    <Section as="article" className="smo-estadisticas">
      <Heading className="smo-pagina__titulo">Estadísticas</Heading>
      <p className="smo-ayuda">Se actualiza cada 30 segundos.</p>
      {error && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="No se pudieron cargar todas las estadísticas"
          subtitle="Se reintentará en el próximo refresco."
        />
      )}

      <div className="smo-indicadores">
        <TarjetaIndicador
          titulo="Tiempo de respuesta promedio"
          valor={
            rendimiento.data?.promedioMs === null || !rendimiento.data
              ? '—'
              : `${rendimiento.data.promedioMs} ms`
          }
          detalle={
            rendimiento.data
              ? `${rendimiento.data.peticiones} peticiones · p95 ${rendimiento.data.p95Ms ?? '—'} ms (${rango === '1h' ? 'última hora' : 'últimas 24 h'})`
              : ''
          }
          cargando={rendimiento.isPending}
        />
        <TarjetaIndicador
          titulo="Usuarios activos ahora"
          valor={String(usuarios.data?.activosAhora ?? '—')}
          detalle="Con actividad en los últimos 15 minutos"
          cargando={usuarios.isPending}
        />
        <TarjetaIndicador
          titulo="Módulos operativos"
          valor={modulos.data ? `${modulos.data.operativos} de ${modulos.data.total}` : '—'}
          detalle={
            modulos.data?.operativos === modulos.data?.total
              ? 'Todo funciona'
              : 'Revisa la lista de módulos'
          }
          cargando={modulos.isPending}
        />
      </div>

      <div className="smo-estadisticas__rango">
        <ContentSwitcher
          size="sm"
          selectedIndex={rango === '1h' ? 0 : 1}
          onChange={({ name }) => setRango(name as '1h' | '24h')}
          aria-label="Rango del tiempo de respuesta"
        >
          <Switch name="1h" text="Última hora" />
          <Switch name="24h" text="Últimas 24 horas" />
        </ContentSwitcher>
      </div>

      <div className="smo-graficos">
        {rendimiento.data && (
          <Grafico
            titulo="Tiempo de respuesta (ms)"
            tipo="linea"
            ejeValores="Milisegundos"
            datos={rendimiento.data.serie.flatMap((p) => [
              { grupo: 'Promedio', clave: p.inicio, valor: p.promedioMs },
              { grupo: 'Percentil 95', clave: p.inicio, valor: p.p95Ms },
            ])}
            tabla={{
              encabezados: ['Hora', 'Peticiones', 'Promedio (ms)', 'p95 (ms)'],
              filas: rendimiento.data.serie
                .filter((p) => p.peticiones > 0)
                .map((p) => [hora(p.inicio), p.peticiones, p.promedioMs ?? '—', p.p95Ms ?? '—']),
            }}
          />
        )}
        {usuarios.data && (
          <Grafico
            titulo="Usuarios por día (últimos 30 días)"
            tipo="barras"
            ejeValores="Usuarios"
            datos={usuarios.data.porDia.map((d) => ({
              grupo: 'Usuarios',
              clave: d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7),
              valor: d.usuarios,
            }))}
            tabla={{
              encabezados: ['Día', 'Usuarios'],
              filas: usuarios.data.porDia.map((d) => [
                d.dia.split('-').reverse().join('/'),
                d.usuarios,
              ]),
            }}
          />
        )}
      </div>

      <Tile className="smo-modulos">
        <h3 className="smo-grafico__titulo">Módulos</h3>
        {modulos.isPending ? (
          <SkeletonText paragraph lineCount={6} />
        ) : (
          <ul aria-label="Estado de los módulos">
            {modulos.data?.modulos.map((m) => (
              <li key={m.modulo} className="smo-modulo">
                <span className={`smo-modulo__estado smo-modulo__estado--${m.estado}`}>
                  {m.estado === 'operativo' ? (
                    <CheckmarkFilled size={16} aria-hidden="true" />
                  ) : (
                    <ErrorFilled size={16} aria-hidden="true" />
                  )}
                  {m.estado === 'operativo' ? 'Operativo' : 'Con fallas'}
                </span>
                <strong className="smo-modulo__nombre">{m.modulo}</strong>
                <span className="smo-modulo__detalle">
                  {m.detalle}
                  {m.latenciaMs !== null ? ` · ${m.latenciaMs} ms` : ''}
                </span>
                <span className="smo-modulo__hora">
                  Verificado: {formatearFechaHora(m.verificadoEn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tile>
    </Section>
  );
}
