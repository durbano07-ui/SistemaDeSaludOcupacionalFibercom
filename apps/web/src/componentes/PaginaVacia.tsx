import { Heading, Section } from '@carbon/react';

interface PaginaVaciaProps {
  titulo: string;
}

/** Página sin contenido todavía: solo muestra su título. */
export function PaginaVacia({ titulo }: PaginaVaciaProps) {
  return (
    <Section as="article">
      <Heading className="smo-pagina__titulo">{titulo}</Heading>
    </Section>
  );
}
