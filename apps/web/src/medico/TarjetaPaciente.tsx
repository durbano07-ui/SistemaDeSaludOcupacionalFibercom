import { ErrorFilled, UserProfile } from '@carbon/icons-react';
import { InlineLoading, InlineNotification, Tag, Tile } from '@carbon/react';
import type { ResumenPaciente } from '@smo/shared';

import { formatearDia } from '../lib/fecha';

interface TarjetaPacienteProps {
  paciente?: ResumenPaciente;
  cargando?: boolean;
  error?: boolean;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="smo-tarjeta__dato">
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

/** Tarjeta del paciente seleccionado (columna izquierda de la pantalla del médico). */
export function TarjetaPaciente({ paciente, cargando, error }: TarjetaPacienteProps) {
  if (cargando) {
    return (
      <Tile className="smo-tarjeta smo-tarjeta--vacia">
        <InlineLoading description="Cargando paciente…" />
      </Tile>
    );
  }
  if (error) {
    return (
      <Tile className="smo-tarjeta">
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="No se pudo cargar el paciente"
          subtitle="Inténtalo de nuevo."
        />
      </Tile>
    );
  }
  if (!paciente) {
    return (
      <Tile className="smo-tarjeta smo-tarjeta--vacia">
        <UserProfile size={32} aria-hidden="true" />
        <p>No se ha seleccionado ningún paciente</p>
      </Tile>
    );
  }

  const caso = paciente.casoAbierto;
  return (
    <Tile className="smo-tarjeta" aria-label="Paciente seleccionado">
      <h2 className="smo-tarjeta__nombre">
        {paciente.apellidos} {paciente.nombres}
      </h2>
      <dl className="smo-tarjeta__datos">
        <Dato etiqueta="Cédula" valor={paciente.cedula} />
        <Dato etiqueta="Edad" valor={`${paciente.edad} años`} />
        <Dato etiqueta="Sexo" valor={paciente.sexo === 'mujer' ? 'Mujer' : 'Hombre'} />
        <Dato etiqueta="Cargo" valor={paciente.cargo} />
        <Dato etiqueta="Base" valor={paciente.base} />
      </dl>

      {paciente.alergias ? (
        <p className="smo-alergia" role="note">
          <ErrorFilled size={16} aria-hidden="true" />
          <span>
            <strong>Alergias:</strong> {paciente.alergias}
          </span>
        </p>
      ) : (
        <p className="smo-tarjeta__sin-alergias">Sin alergias registradas</p>
      )}

      {paciente.condiciones.length > 0 && (
        <div className="smo-tarjeta__condiciones" aria-label="Condiciones prioritarias">
          {paciente.condiciones.map((c) => (
            <Tag key={`${c.tipo}-${c.nombre}`} type="purple" size="sm">
              {c.nombre}
              {c.detalle ? ` (${c.detalle})` : ''}
            </Tag>
          ))}
        </div>
      )}

      <div className="smo-tarjeta__caso">
        <span className="smo-tarjeta__etiqueta">Caso abierto</span>
        {caso ? (
          <p>
            <strong>{caso.cie10.codigo}</strong> — {caso.cie10.descripcion}
            <br />
            <span className="smo-tarjeta__desde">Desde el {formatearDia(caso.fechaApertura)}</span>
          </p>
        ) : (
          <p>Sin caso abierto</p>
        )}
      </div>
    </Tile>
  );
}
