import { Grafico } from '../componentes/graficos/Grafico';
import { type FiltrosAplicados, useGestion } from '../lib/consultas-reportes';
import { EstadoReporte } from './comunes';

/** Estadísticas de gestión del año: donas, barras por mes, top 5 CIE-10, por base y por cargo. */
export function PestanaGestion({ filtros }: { filtros: FiltrosAplicados }) {
  const consulta = useGestion(filtros);
  const d = consulta.data;
  const conteo = (grupo: string, lista: { nombre: string; total: number }[]) =>
    lista.map((x) => ({ grupo: grupo === '' ? x.nombre : grupo, clave: x.nombre, valor: x.total }));

  return (
    <section aria-label="Estadísticas de gestión">
      <h2 className="smo-reporte__titulo">
        Estadísticas de gestión · {filtros.anio}
        {d ? ` · ${d.total} atenciones` : ''}
      </h2>
      <EstadoReporte
        cargando={consulta.isPending}
        error={consulta.isError}
        vacio={!d || d.total === 0}
        onReintentar={() => void consulta.refetch()}
      >
        {d && (
          <div className="smo-graficos">
            <Grafico titulo="Por tipo de evento" tipo="dona" datos={conteo('', d.porTipoEvento)} />
            <Grafico
              titulo="Por tipo de atención"
              tipo="dona"
              datos={conteo('', d.porTipoAtencion)}
            />
            <Grafico
              titulo="Atenciones por mes"
              tipo="barras"
              datos={d.porMes.map((m) => ({
                grupo: 'Atenciones',
                clave: m.nombre.slice(0, 3),
                valor: m.total,
              }))}
              tabla={{
                encabezados: ['Mes', 'Atenciones'],
                filas: d.porMes.map((m) => [m.nombre, m.total]),
              }}
            />
            <Grafico
              titulo="Top 5 diagnósticos CIE-10 (atenciones primeras)"
              tipo="barras-horizontales"
              ejeValores="Casos"
              datos={d.topCie10.map((c) => ({ grupo: 'Casos', clave: c.codigo, valor: c.casos }))}
              tabla={{
                encabezados: ['Código', 'Descripción', 'Casos'],
                filas: d.topCie10.map((c) => [c.codigo, c.descripcion, c.casos]),
              }}
            />
            <Grafico
              titulo="Por base"
              tipo="barras"
              datos={conteo('Atenciones', d.porBase)}
              tabla={{
                encabezados: ['Base', 'Atenciones'],
                filas: d.porBase.map((b) => [b.nombre, b.total]),
              }}
            />
            <Grafico
              titulo="Por cargo"
              tipo="barras-horizontales"
              alto="420px"
              datos={conteo('Atenciones', d.porCargo)}
              tabla={{
                encabezados: ['Cargo', 'Atenciones'],
                filas: d.porCargo.map((c) => [c.nombre, c.total]),
              }}
            />
          </div>
        )}
      </EstadoReporte>
    </section>
  );
}
