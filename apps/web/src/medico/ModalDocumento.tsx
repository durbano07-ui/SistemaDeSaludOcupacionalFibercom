import { ErrorFilled, Printer } from '@carbon/icons-react';
import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@carbon/react';
import type { AtencionDetalle } from '@smo/shared';
import { createPortal } from 'react-dom';

import { Logo } from '../componentes/Logo';
import { useAtencionDetalle } from '../lib/consultas-medico';
import { EMPRESA } from '../lib/empresa';
import { formatearDia, formatearFecha, formatearFechaHora } from '../lib/fecha';

export type TipoDocumento = 'receta' | 'certificado';

interface ModalDocumentoProps {
  idAtencion: number | null;
  tipo: TipoDocumento;
  onCerrar: () => void;
}

function Encabezado({
  detalle,
  titulo,
  codigo,
}: {
  detalle: AtencionDetalle;
  titulo: string;
  codigo: string;
}) {
  return (
    <header className="smo-documento__encabezado">
      <Logo />
      <div className="smo-documento__empresa">
        <strong>{EMPRESA.nombre}</strong>
        <span>{EMPRESA.area}</span>
        <span>Base {detalle.paciente.base}</span>
        {EMPRESA.ruc && <span>RUC {EMPRESA.ruc}</span>}
        {EMPRESA.direccion && <span>{EMPRESA.direccion}</span>}
        {EMPRESA.telefono && <span>Tel. {EMPRESA.telefono}</span>}
      </div>
      <div className="smo-documento__titulo">
        <h2>{titulo}</h2>
        <span>{codigo}</span>
        <span>{formatearFechaHora(detalle.fecha).slice(0, 16)}</span>
      </div>
    </header>
  );
}

function DatosPaciente({ detalle }: { detalle: AtencionDetalle }) {
  const p = detalle.paciente;
  return (
    <dl className="smo-documento__paciente">
      <div>
        <dt>Paciente</dt>
        <dd>
          {p.apellidos} {p.nombres}
        </dd>
      </div>
      <div>
        <dt>Cédula</dt>
        <dd>{p.cedula}</dd>
      </div>
      <div>
        <dt>Edad</dt>
        <dd>{p.edad} años</dd>
      </div>
      <div>
        <dt>Cargo</dt>
        <dd>{p.cargo}</dd>
      </div>
      <div>
        <dt>Diagnóstico</dt>
        <dd>
          {detalle.diagnostico.codigo} — {detalle.diagnostico.descripcion}
        </dd>
      </div>
    </dl>
  );
}

function Firma({ detalle }: { detalle: AtencionDetalle }) {
  const m = detalle.medico;
  return (
    <footer className="smo-documento__firma">
      <div className="smo-documento__linea" />
      <strong>
        Dr(a). {m.nombres} {m.apellidos}
      </strong>
      <span>Médico ocupacional{m.codigoMedico ? ` · Cód. ${m.codigoMedico}` : ''}</span>
      <span className="smo-documento__sello">Firma y sello</span>
    </footer>
  );
}

function Receta({ detalle }: { detalle: AtencionDetalle }) {
  const receta = detalle.receta!;
  return (
    <article className="smo-documento" aria-label="Receta médica">
      <Encabezado detalle={detalle} titulo="Receta médica" codigo={detalle.codigo} />
      <DatosPaciente detalle={detalle} />
      {receta.advertencias && (
        <p className="smo-alergia">
          <ErrorFilled size={16} aria-hidden="true" />
          <span>{receta.advertencias}</span>
        </p>
      )}
      {receta.medicamentos.length > 0 && (
        <table className="smo-documento__tabla">
          <thead>
            <tr>
              <th>Medicamento</th>
              <th>Cantidad</th>
              <th>Indicaciones</th>
            </tr>
          </thead>
          <tbody>
            {receta.medicamentos.map((m) => (
              <tr key={`${m.nombre}-${m.presentacion}-${m.concentracion}`}>
                <td>
                  <strong>{m.nombre}</strong> {m.concentracion}
                  <br />
                  {m.presentacion}
                </td>
                <td>{m.cantidad}</td>
                <td>
                  {m.dosis}, {m.frecuencia}, durante {m.duracion}.
                  {m.indicaciones ? ` ${m.indicaciones}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {receta.recomendaciones && (
        <section>
          <h3>Recomendaciones</h3>
          <p>{receta.recomendaciones}</p>
        </section>
      )}
      {receta.signosAlarma && (
        <section>
          <h3>Signos de alarma</h3>
          <p>{receta.signosAlarma}</p>
        </section>
      )}
      {detalle.proximaCita && (
        <p>
          <strong>Próxima cita:</strong> {formatearDia(detalle.proximaCita)}
        </p>
      )}
      <Firma detalle={detalle} />
    </article>
  );
}

function Certificado({ detalle }: { detalle: AtencionDetalle }) {
  const c = detalle.certificado!;
  const p = detalle.paciente;
  const tratamiento = p.sexo === 'mujer' ? 'la señora' : 'el señor';
  return (
    <article className="smo-documento" aria-label="Certificado de reposo">
      <Encabezado detalle={detalle} titulo="Certificado de reposo" codigo={c.codigo} />
      <p className="smo-documento__texto">
        Certifico que {tratamiento}{' '}
        <strong>
          {p.apellidos} {p.nombres}
        </strong>
        , con cédula {p.cedula}, {p.cargo} de la base {p.base}, fue atendido(a) en este consultorio
        el {formatearFecha(detalle.fecha)} con el diagnóstico{' '}
        <strong>
          {detalle.diagnostico.codigo} — {detalle.diagnostico.descripcion}
        </strong>
        , y requiere reposo de <strong>{c.dias === 1 ? '1 día' : `${c.dias} días`}</strong>, desde
        el <strong>{formatearDia(c.fechaInicio)}</strong> hasta el{' '}
        <strong>{formatearDia(c.fechaFin)}</strong>, inclusive.
      </p>
      {c.observacion && <p>{c.observacion}</p>}
      <Firma detalle={detalle} />
    </article>
  );
}

/** Ver receta / ver certificado: formato listo para imprimir. */
export function ModalDocumento({ idAtencion, tipo, onCerrar }: ModalDocumentoProps) {
  const consulta = useAtencionDetalle(idAtencion);
  const detalle = consulta.data;
  const titulo = tipo === 'receta' ? 'Receta médica' : 'Certificado de reposo';
  const disponible = detalle && (tipo === 'receta' ? detalle.receta : detalle.certificado);

  return (
    <ComposedModal
      open={idAtencion !== null}
      onClose={onCerrar}
      size="lg"
      className="smo-modal smo-modal--documento"
      aria-label={titulo}
    >
      <ModalHeader title={titulo} closeModal={onCerrar} iconDescription="Cerrar" />
      <ModalBody>
        {consulta.isPending ? (
          <InlineLoading description="Cargando…" />
        ) : consulta.isError ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title="No se pudo cargar el documento"
            subtitle="Inténtalo de nuevo."
          />
        ) : !disponible ? (
          <p>Esta atención no tiene {tipo === 'receta' ? 'receta' : 'certificado'}.</p>
        ) : (
          <div className="smo-impresion">
            {tipo === 'receta' ? <Receta detalle={detalle} /> : <Certificado detalle={detalle} />}
          </div>
        )}
        {disponible &&
          createPortal(
            // Copia que solo se ve al imprimir (ver _medico.scss)
            <div className="smo-zona-impresion" aria-hidden="true">
              {tipo === 'receta' ? <Receta detalle={detalle} /> : <Certificado detalle={detalle} />}
            </div>,
            document.body,
          )}
      </ModalBody>
      <ModalFooter className="smo-modal__pie">
        <Button kind="secondary" onClick={onCerrar}>
          Cerrar
        </Button>
        <Button
          kind="primary"
          renderIcon={Printer}
          disabled={!disponible}
          onClick={() => window.print()}
        >
          Imprimir
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
