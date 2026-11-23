import { CheckmarkFilled, ErrorFilled } from '@carbon/icons-react';
import { Button, Heading, InlineLoading, Section, Tile } from '@carbon/react';
import { respuestaSaludSchema } from '@smo/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { pedir } from '../lib/api';
import { formatearFechaHora } from '../lib/fecha';

function Estado({ ok, textoOk, textoError }: { ok: boolean; textoOk: string; textoError: string }) {
  return ok ? (
    <p className="smo-estado smo-estado--ok">
      <CheckmarkFilled size={20} aria-hidden="true" />
      {textoOk}
    </p>
  ) : (
    <p className="smo-estado smo-estado--error" role="alert">
      <ErrorFilled size={20} aria-hidden="true" />
      {textoError}
    </p>
  );
}

/** Página de inicio: comprueba que la API y la base de datos respondan. */
export function Inicio() {
  const salud = useQuery({
    queryKey: ['salud'],
    queryFn: () => pedir('/salud', respuestaSaludSchema),
    retry: false,
  });

  return (
    <main className="smo-inicio">
      <Section>
        <Heading>Sistema de Medicina Ocupacional</Heading>
        <p>FIBERCOM ECUADOR</p>

        <div className="smo-inicio__estados" aria-live="polite">
          <Tile>
            <h2 className="cds--type-heading-compact-01">API</h2>
            {salud.isPending ? (
              <InlineLoading description="Verificando…" />
            ) : (
              <Estado
                ok={salud.isSuccess}
                textoOk="La API responde"
                textoError="La API no responde"
              />
            )}
          </Tile>
          <Tile>
            <h2 className="cds--type-heading-compact-01">Base de datos</h2>
            {salud.isPending ? (
              <InlineLoading description="Verificando…" />
            ) : (
              <Estado
                ok={salud.data?.baseDatos === 'ok'}
                textoOk="La base de datos responde"
                textoError="La base de datos no responde"
              />
            )}
          </Tile>
        </div>

        {salud.data && (
          <p className="cds--type-helper-text-01">
            Última verificación: {formatearFechaHora(salud.data.hora)} (hora de Ecuador)
          </p>
        )}

        <div className="smo-inicio__acciones">
          <Button as={Link} to="/admin">
            Layout de administrador
          </Button>
          <Button as={Link} to="/medico" kind="tertiary">
            Layout de médico
          </Button>
        </div>
      </Section>
    </main>
  );
}
