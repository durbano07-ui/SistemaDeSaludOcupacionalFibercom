import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import {
  type ActualizarMetaSst,
  actualizarMetaSstSchema,
  type IndicadorSst,
  type MetaSst,
  NOMBRES_INDICADOR_SST,
  NOMBRES_TIPO_META,
  TIPOS_META_SST,
} from '@smo/shared';
import { useState } from 'react';

import { ErrorApi } from '../lib/api';
import { useGuardarMetas, useMetasSst } from '../lib/consultas-reportes';

interface Fila {
  indicador: IndicadorSst;
  texto: string;
  tipo: (typeof TIPOS_META_SST)[number];
  limite: string;
}

const aFila = (m: MetaSst): Fila => ({
  indicador: m.indicador,
  texto: m.texto,
  tipo: m.tipo,
  limite: m.limite === null ? '' : String(m.limite).replace('.', ','),
});

function Formulario({ metas, onCerrar }: { metas: MetaSst[]; onCerrar: () => void }) {
  const [filas, setFilas] = useState(metas.map(aFila));
  const [errores, setErrores] = useState<Record<string, Record<string, string>>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const guardar = useGuardarMetas();

  const cambiar = (indice: number, cambios: Partial<Fila>) =>
    setFilas((actuales) => actuales.map((f, i) => (i === indice ? { ...f, ...cambios } : f)));

  const enviar = async () => {
    const nuevosErrores: typeof errores = {};
    const cambios: { indicador: IndicadorSst; datos: ActualizarMetaSst }[] = [];
    filas.forEach((fila, i) => {
      const resultado = actualizarMetaSstSchema.safeParse(fila);
      if (!resultado.success) {
        nuevosErrores[fila.indicador] = Object.fromEntries(
          resultado.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        );
        return;
      }
      const original = metas[i]!;
      const d = resultado.data;
      if (d.texto !== original.texto || d.tipo !== original.tipo || d.limite !== original.limite) {
        cambios.push({ indicador: fila.indicador, datos: d });
      }
    });
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return;
    if (cambios.length === 0) return onCerrar();
    try {
      await guardar.mutateAsync(cambios);
      onCerrar();
    } catch (error) {
      setErrorGeneral(
        error instanceof ErrorApi
          ? (error.detalle ?? error.titulo)
          : 'No se pudieron guardar las metas.',
      );
    }
  };

  return (
    <>
      <ModalBody hasForm>
        {errorGeneral && (
          <InlineNotification
            kind="error"
            lowContrast
            title="No se pudieron guardar las metas"
            subtitle={errorGeneral}
            onClose={() => setErrorGeneral(null)}
          />
        )}
        <div className="smo-metas">
          {filas.map((fila, i) => (
            <fieldset key={fila.indicador} className="smo-metas__fila">
              <legend className="smo-metas__indicador">
                {NOMBRES_INDICADOR_SST[fila.indicador]}
              </legend>
              <TextInput
                id={`meta-texto-${fila.indicador}`}
                labelText="Texto (columna Meta SST)"
                value={fila.texto}
                maxLength={60}
                invalid={Boolean(errores[fila.indicador]?.texto)}
                invalidText={errores[fila.indicador]?.texto}
                onChange={(e) => cambiar(i, { texto: e.target.value })}
              />
              <Select
                id={`meta-tipo-${fila.indicador}`}
                labelText="Tipo"
                value={fila.tipo}
                onChange={(e) => cambiar(i, { tipo: e.target.value as Fila['tipo'] })}
              >
                {TIPOS_META_SST.map((t) => (
                  <SelectItem key={t} value={t} text={NOMBRES_TIPO_META[t]} />
                ))}
              </Select>
              <TextInput
                id={`meta-limite-${fila.indicador}`}
                labelText={fila.tipo === 'porcentaje_maximo' ? 'Límite (%)' : 'Límite (casos)'}
                inputMode="decimal"
                value={fila.tipo === 'informativa' ? '' : fila.limite}
                disabled={fila.tipo === 'informativa'}
                invalid={Boolean(errores[fila.indicador]?.limite)}
                invalidText={errores[fila.indicador]?.limite}
                onChange={(e) => cambiar(i, { limite: e.target.value })}
              />
            </fieldset>
          ))}
        </div>
      </ModalBody>
      <ModalFooter className="smo-modal__pie">
        <Button kind="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button kind="primary" disabled={guardar.isPending} onClick={() => void enviar()}>
          {guardar.isPending ? <InlineLoading description="Guardando…" /> : 'Guardar metas'}
        </Button>
      </ModalFooter>
    </>
  );
}

/** Modal "Editar metas": las 5 metas SST (texto, tipo y límite). */
export function ModalMetas({ onCerrar }: { onCerrar: () => void }) {
  const metas = useMetasSst();
  return (
    <ComposedModal open onClose={onCerrar} size="md" className="smo-modal" aria-label="Metas SST">
      <ModalHeader
        title="Metas SST"
        label="Informe trimestral"
        closeModal={onCerrar}
        iconDescription="Cerrar"
      />
      {metas.isPending ? (
        <ModalBody>
          <InlineLoading description="Cargando metas…" />
        </ModalBody>
      ) : metas.isError ? (
        <ModalBody>
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title="No se pudieron cargar las metas"
          />
        </ModalBody>
      ) : (
        <Formulario metas={metas.data} onCerrar={onCerrar} />
      )}
    </ComposedModal>
  );
}
