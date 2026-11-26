import { Link, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import type { AtencionListada } from '@smo/shared';

import { formatearFecha } from '../lib/fecha';
import type { TipoDocumento } from './ModalDocumento';

interface TablaAtencionesProps {
  atenciones: AtencionListada[];
  etiqueta: string;
  /** Pestaña "Atenciones": enlaces "Ver receta / Ver certificado". */
  onVer?: (idAtencion: number, tipo: TipoDocumento) => void;
  /** Pestaña "Consultas anteriores": columna Fecha (solo la fecha), sin acciones. */
  conFecha?: boolean;
}

/** Tabla de atenciones; se desplaza dentro de su caja en pantallas pequeñas. */
export function TablaAtenciones({ atenciones, etiqueta, onVer, conFecha }: TablaAtencionesProps) {
  const enlace = (a: AtencionListada, tipo: TipoDocumento, texto: string) =>
    onVer ? (
      <Link
        href="#"
        onClick={(evento) => {
          evento.preventDefault();
          onVer(a.id, tipo);
        }}
      >
        {texto}
      </Link>
    ) : (
      'Sí'
    );

  return (
    <div className="smo-tabla-desplazable">
      <Table size="md" aria-label={etiqueta}>
        <TableHead>
          <TableRow>
            <TableHeader>{conFecha ? 'Paciente' : 'Nombre del paciente'}</TableHeader>
            <TableHeader>Cédula</TableHeader>
            {conFecha ? <TableHeader>Fecha</TableHeader> : <TableHeader>Cargo</TableHeader>}
            <TableHeader>Motivo</TableHeader>
            <TableHeader>Diagnóstico</TableHeader>
            <TableHeader>Receta</TableHeader>
            <TableHeader>Certificado</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {atenciones.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                {a.paciente.apellidos} {a.paciente.nombres}
              </TableCell>
              <TableCell>{a.paciente.cedula}</TableCell>
              <TableCell>{conFecha ? formatearFecha(a.fecha) : a.cargo}</TableCell>
              <TableCell>{a.motivo}</TableCell>
              <TableCell>
                <strong>{a.diagnostico.codigo}</strong> {a.diagnostico.descripcion}
              </TableCell>
              <TableCell>{a.tieneReceta ? enlace(a, 'receta', 'Ver receta') : '—'}</TableCell>
              <TableCell>
                {a.tieneCertificado ? enlace(a, 'certificado', 'Ver certificado') : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
