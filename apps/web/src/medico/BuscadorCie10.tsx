import { ComboBox } from '@carbon/react';
import type { Cie10 } from '@smo/shared';
import { useState } from 'react';

import { useBuscarCie10, useRetardado } from '../lib/consultas-medico';

const textoCie10 = (c: Cie10 | null | undefined) => (c ? `${c.codigo} — ${c.descripcion}` : '');

interface BuscadorCie10Props {
  id: string;
  titulo: string;
  elegido: Cie10 | null;
  onElegir: (cie10: Cie10 | null) => void;
  ayuda?: string;
  error?: string;
}

/** Buscador de un diagnóstico CIE-10 por código o texto (desde 2 caracteres, 300 ms). */
export function BuscadorCie10({ id, titulo, elegido, onElegir, ayuda, error }: BuscadorCie10Props) {
  const [texto, setTexto] = useState('');
  const busqueda = useBuscarCie10(useRetardado(texto, 300));

  return (
    <ComboBox<Cie10>
      id={id}
      titleText={titulo}
      placeholder="Buscar por código o texto"
      helperText={ayuda}
      items={busqueda.data ?? (elegido ? [elegido] : [])}
      itemToString={textoCie10}
      selectedItem={elegido}
      onInputChange={(valor) => setTexto(valor ?? '')}
      onChange={({ selectedItem }) => onElegir(selectedItem ?? null)}
      invalid={Boolean(error)}
      invalidText={error}
    />
  );
}
