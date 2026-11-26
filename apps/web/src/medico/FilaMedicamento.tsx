import { TrashCan } from '@carbon/icons-react';
import { Button, ComboBox, TextInput } from '@carbon/react';
import type { Medicamento, NuevaAtencionEntrada } from '@smo/shared';
import { useState } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { useBuscarMedicamentos, useRetardado } from '../lib/consultas-medico';

const textoMedicamento = (m: Medicamento | null | undefined) =>
  m ? `${m.nombre} ${m.concentracion} · ${m.presentacion}` : '';

interface FilaMedicamentoProps {
  indice: number;
  elegido: Medicamento | undefined;
  register: UseFormRegister<NuevaAtencionEntrada>;
  errores: FieldErrors<NuevaAtencionEntrada>;
  onElegir: (medicamento: Medicamento | null) => void;
  onQuitar: () => void;
}

/** Una fila de la receta: medicamento (buscador), cantidad, dosis, frecuencia, duración, indicaciones. */
export function FilaMedicamento({
  indice,
  elegido,
  register,
  errores,
  onElegir,
  onQuitar,
}: FilaMedicamentoProps) {
  const [texto, setTexto] = useState('');
  const busqueda = useBuscarMedicamentos(useRetardado(texto, 300));
  const error = errores.receta?.medicamentos?.[indice];
  const campo = (nombre: 'cantidad' | 'dosis' | 'frecuencia' | 'duracion' | 'indicaciones') =>
    `receta.medicamentos.${indice}.${nombre}` as const;
  const items = busqueda.data ?? (elegido ? [elegido] : []);

  return (
    <fieldset className="smo-fila-medicamento" aria-label={`Medicamento ${indice + 1}`}>
      <ComboBox<Medicamento>
        id={`medicamento-${indice}`}
        className="smo-fila-medicamento__nombre"
        titleText="Medicamento"
        placeholder="Buscar por nombre o grupo"
        items={items}
        itemToString={textoMedicamento}
        selectedItem={elegido ?? null}
        onInputChange={(valor) => setTexto(valor ?? '')}
        onChange={({ selectedItem }) => onElegir(selectedItem ?? null)}
        invalid={Boolean(error?.idMedicamento)}
        invalidText={error?.idMedicamento?.message}
      />
      <TextInput
        id={`cantidad-${indice}`}
        labelText="Cantidad"
        inputMode="numeric"
        invalid={Boolean(error?.cantidad)}
        invalidText={error?.cantidad?.message}
        {...register(campo('cantidad'))}
      />
      <TextInput
        id={`dosis-${indice}`}
        labelText="Dosis"
        placeholder="1 tableta"
        invalid={Boolean(error?.dosis)}
        invalidText={error?.dosis?.message}
        {...register(campo('dosis'))}
      />
      <TextInput
        id={`frecuencia-${indice}`}
        labelText="Frecuencia"
        placeholder="cada 8 horas"
        invalid={Boolean(error?.frecuencia)}
        invalidText={error?.frecuencia?.message}
        {...register(campo('frecuencia'))}
      />
      <TextInput
        id={`duracion-${indice}`}
        labelText="Duración"
        placeholder="5 días"
        invalid={Boolean(error?.duracion)}
        invalidText={error?.duracion?.message}
        {...register(campo('duracion'))}
      />
      <TextInput
        id={`indicaciones-${indice}`}
        className="smo-fila-medicamento__indicaciones"
        labelText="Indicaciones (opcional)"
        invalid={Boolean(error?.indicaciones)}
        invalidText={error?.indicaciones?.message}
        {...register(campo('indicaciones'))}
      />
      <Button
        kind="ghost"
        size="md"
        hasIconOnly
        renderIcon={TrashCan}
        iconDescription={`Quitar medicamento ${indice + 1}`}
        tooltipPosition="left"
        onClick={onQuitar}
      />
    </fieldset>
  );
}
