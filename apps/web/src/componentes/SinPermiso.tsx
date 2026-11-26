import { Locked } from '@carbon/icons-react';
import { Heading, Section } from '@carbon/react';

/** Se muestra al entrar a una sección sin el permiso necesario. */
export function SinPermiso({ mensaje }: { mensaje?: string }) {
  return (
    <Section as="article" className="smo-sin-permiso">
      <Locked size={32} aria-hidden="true" />
      <Heading>Sin acceso</Heading>
      <p>
        {mensaje ??
          'No tienes permiso para ver esta sección. Si lo necesitas, pídelo al administrador.'}
      </p>
    </Section>
  );
}
