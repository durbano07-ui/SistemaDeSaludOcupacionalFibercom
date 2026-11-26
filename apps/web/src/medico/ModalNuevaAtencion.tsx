import { Add } from '@carbon/icons-react';
import {
  Accordion,
  AccordionItem,
  Button,
  Checkbox,
  ComboBox,
  ComposedModal,
  FormGroup,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import {
  alertasSignosVitales,
  type AtencionRegistrada,
  calcularFechaFin,
  type Cie10,
  coincidenciasAlergia,
  fechaLocal,
  fechaSchema,
  horaLocalDeInstante,
  type Medicamento,
  NOMBRES_TIPO_EVENTO,
  type NuevaAtencion,
  nuevaAtencionSchema,
  requierePreguntaTrabajo,
  type ResumenPaciente,
  type SignosVitales,
  TIPOS_EVENTO,
} from '@smo/shared';
import { useEffect, useState } from 'react';
import { type FieldPath, useFieldArray } from 'react-hook-form';

import { ErrorApi } from '../lib/api';
import { useBuscarCie10, useRegistrarAtencion, useRetardado } from '../lib/consultas-medico';
import { formatearDia } from '../lib/fecha';
import { useFormulario } from '../lib/formulario';
import { FilaMedicamento } from './FilaMedicamento';

interface ModalNuevaAtencionProps {
  paciente: ResumenPaciente;
  onCerrar: () => void;
  onGuardada: (atencion: AtencionRegistrada) => void;
}

const FORMULARIO = 'form-nueva-atencion';
const textoCie10 = (c: Cie10 | null | undefined) => (c ? `${c.codigo} — ${c.descripcion}` : '');

const CAMPOS_SIGNOS: { nombre: keyof SignosVitales; etiqueta: string }[] = [
  { nombre: 'presionSistolica', etiqueta: 'TA sistólica (mmHg)' },
  { nombre: 'presionDiastolica', etiqueta: 'TA diastólica (mmHg)' },
  { nombre: 'frecuenciaCardiaca', etiqueta: 'FC (lpm)' },
  { nombre: 'frecuenciaRespiratoria', etiqueta: 'FR (rpm)' },
  { nombre: 'saturacionO2', etiqueta: 'SatO2 (%)' },
  { nombre: 'temperatura', etiqueta: 'Temperatura (°C)' },
];

const comoNumero = (valor: unknown) => {
  if (valor === '' || valor === null || valor === undefined) return undefined;
  const numero = Number(String(valor).replace(',', '.'));
  return Number.isNaN(numero) ? undefined : numero;
};

/** Modal "Nueva atención": atención, evolución, signos vitales, receta, certificado y próxima cita. */
export function ModalNuevaAtencion({ paciente, onCerrar, onGuardada }: ModalNuevaAtencionProps) {
  const caso = paciente.casoAbierto;
  const registrar = useRegistrarAtencion(paciente.id);
  const [errorGeneral, setErrorGeneral] = useState<{ titulo: string; detalle?: string } | null>(
    null,
  );
  const [cie10, setCie10] = useState<Cie10 | null>(null);
  const [textoCie, setTextoCie] = useState('');
  const busquedaCie10 = useBuscarCie10(useRetardado(textoCie, 300));
  const [medicamentos, setMedicamentos] = useState<Record<string, Medicamento>>({});
  const [conCertificado, setConCertificado] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    unregister,
    formState: { errors, isSubmitting, isSubmitted },
  } = useFormulario(nuevaAtencionSchema, {
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      idPaciente: paciente.id,
      tipoAtencion: 'primera',
      fecha: horaLocalDeInstante(new Date()),
      motivo: '',
      enfermedadActual: '',
      idCie10: '',
      tipoEvento: 'enfermedad_comun',
      ocurrioEnTrabajo: undefined,
      signosVitales: Object.fromEntries(CAMPOS_SIGNOS.map((c) => [c.nombre, ''])),
      examenFisico: '',
      tratamiento: '',
      observaciones: '',
      receta: {
        medicamentos: [],
        recomendaciones: '',
        signosAlarma: '',
        recetarDeTodosModos: false,
      },
      proximaCita: '',
    },
  });
  const filas = useFieldArray({ control, name: 'receta.medicamentos' });

  const tipoAtencion = watch('tipoAtencion');
  const idCie10 = watch('idCie10');
  const tipoEvento = watch('tipoEvento');
  const ocurrio = watch('ocurrioEnTrabajo');
  const signos = watch('signosVitales');
  const filasReceta = watch('receta.medicamentos');
  const recetarDeTodosModos = watch('receta.recetarDeTodosModos');
  const fecha = watch('fecha');
  const certificadoDias = watch('certificado.dias');
  const certificadoInicio = watch('certificado.fechaInicio');

  const opciones = { shouldValidate: isSubmitted, shouldDirty: true } as const;
  const preguntaTrabajo = requierePreguntaTrabajo(idCie10) || tipoEvento === 'accidente_trabajo';

  // La pregunta "¿Ocurrió en el trabajo?" solo aplica a S/T o accidentes de trabajo
  useEffect(() => {
    if (!preguntaTrabajo && ocurrio !== undefined) setValue('ocurrioEnTrabajo', undefined);
  }, [preguntaTrabajo, ocurrio, setValue]);

  // RN-06: alergias del paciente contra los medicamentos elegidos
  const elegidos = (filasReceta ?? [])
    .map((fila) => medicamentos[String(fila.idMedicamento)])
    .filter((m): m is Medicamento => Boolean(m));
  const alertasAlergia = coincidenciasAlergia(
    paciente.alergias,
    elegidos.map((m) => ({
      idMedicamento: m.id,
      nombre: m.nombre,
      grupoFarmacologico: m.grupoFarmacologico,
    })),
  );

  // RN-09: alertas (no impiden guardar)
  const alertasSignos = alertasSignosVitales(
    Object.fromEntries(CAMPOS_SIGNOS.map((c) => [c.nombre, comoNumero(signos?.[c.nombre])])),
  );

  const fechaFin =
    conCertificado &&
    fechaSchema.safeParse(certificadoInicio).success &&
    Number(certificadoDias) >= 1 &&
    Number(certificadoDias) <= 365 &&
    Number.isInteger(Number(certificadoDias))
      ? calcularFechaFin(String(certificadoInicio), Number(certificadoDias))
      : null;

  const sugerirSubsecuente = caso && tipoAtencion === 'primera' && idCie10 === caso.cie10.codigo;

  const alternarCertificado = (marcado: boolean) => {
    setConCertificado(marcado);
    if (marcado) {
      const dia = /^\d{4}-\d{2}-\d{2}/.test(String(fecha))
        ? String(fecha).slice(0, 10)
        : fechaLocal(new Date());
      setValue('certificado', { dias: '1', fechaInicio: dia });
    } else {
      unregister('certificado');
    }
  };

  const guardar = handleSubmit(async (datos: NuevaAtencion) => {
    setErrorGeneral(null);
    if (alertasAlergia.length > 0 && !datos.receta?.recetarDeTodosModos) {
      setError('receta.recetarDeTodosModos', {
        message: 'Confirma marcando «Recetar de todos modos» o quita el medicamento.',
      });
      return;
    }
    try {
      onGuardada(await registrar.mutateAsync(datos));
    } catch (error) {
      if (error instanceof ErrorApi) {
        for (const { campo, mensaje } of error.errores ?? []) {
          setError(campo as FieldPath<typeof datos>, { message: mensaje });
        }
        setErrorGeneral({ titulo: 'No se pudo guardar la atención', detalle: error.detalle });
      } else {
        setErrorGeneral({
          titulo: 'No se pudo guardar la atención',
          detalle: 'Revisa tu conexión e inténtalo de nuevo.',
        });
      }
    }
  });

  const avisoCaso =
    tipoAtencion === 'subsecuente' && caso
      ? `Se sumará al caso abierto ${caso.cie10.codigo} (${caso.cie10.descripcion}), abierto el ${formatearDia(caso.fechaApertura)}.`
      : caso
        ? `Se cerrará el caso abierto ${caso.cie10.codigo} y se abrirá uno nuevo con el diagnóstico elegido.`
        : 'Se abrirá un caso nuevo con el diagnóstico elegido.';

  return (
    <ComposedModal
      open
      onClose={onCerrar}
      size="lg"
      className="smo-modal smo-modal--atencion"
      aria-label="Nueva atención"
      preventCloseOnClickOutside
    >
      <ModalHeader
        title="Nueva atención"
        label={`${paciente.apellidos} ${paciente.nombres}`}
        closeModal={onCerrar}
        iconDescription="Cerrar"
      />
      <ModalBody hasForm>
        <form id={FORMULARIO} noValidate onSubmit={guardar} aria-label="Nueva atención">
          <Stack gap={6}>
            {errorGeneral && (
              <InlineNotification
                kind="error"
                role="alert"
                lowContrast
                title={errorGeneral.titulo}
                subtitle={errorGeneral.detalle}
                onClose={() => setErrorGeneral(null)}
              />
            )}

            {/* Tipo de atención */}
            <RadioButtonGroup
              legendText="Tipo de atención"
              name="tipoAtencion"
              valueSelected={tipoAtencion}
              onChange={(valor) =>
                setValue('tipoAtencion', valor as 'primera' | 'subsecuente', opciones)
              }
            >
              <RadioButton id="tipo-primera" labelText="Primera" value="primera" />
              <RadioButton
                id="tipo-subsecuente"
                labelText="Subsecuente"
                value="subsecuente"
                disabled={!caso}
              />
            </RadioButtonGroup>
            <InlineNotification
              kind="info"
              lowContrast
              hideCloseButton
              title="Caso"
              subtitle={avisoCaso}
            />

            <div className="smo-formulario__fila">
              <TextInput
                id="atencion-fecha"
                type="datetime-local"
                labelText="Fecha y hora"
                max={horaLocalDeInstante(new Date())}
                invalid={Boolean(errors.fecha)}
                invalidText={errors.fecha?.message}
                {...register('fecha')}
              />
              <Select
                id="atencion-tipo-evento"
                labelText="Tipo de evento"
                invalid={Boolean(errors.tipoEvento)}
                invalidText={errors.tipoEvento?.message}
                {...register('tipoEvento')}
              >
                {TIPOS_EVENTO.map((t) => (
                  <SelectItem key={t} value={t} text={NOMBRES_TIPO_EVENTO[t]} />
                ))}
              </Select>
            </div>

            <TextInput
              id="atencion-motivo"
              labelText="Motivo"
              invalid={Boolean(errors.motivo)}
              invalidText={errors.motivo?.message}
              {...register('motivo')}
            />
            <TextArea
              id="atencion-enfermedad"
              labelText="Enfermedad actual"
              rows={3}
              invalid={Boolean(errors.enfermedadActual)}
              invalidText={errors.enfermedadActual?.message}
              {...register('enfermedadActual')}
            />

            {/* Diagnóstico */}
            <ComboBox<Cie10>
              id="atencion-cie10"
              titleText="Diagnóstico CIE-10"
              placeholder="Buscar por código o texto"
              helperText="Escribe al menos 2 caracteres"
              items={busquedaCie10.data ?? (cie10 ? [cie10] : [])}
              itemToString={textoCie10}
              selectedItem={cie10}
              onInputChange={(valor) => setTextoCie(valor ?? '')}
              onChange={({ selectedItem }) => {
                setCie10(selectedItem ?? null);
                setValue('idCie10', selectedItem?.codigo ?? '', opciones);
              }}
              invalid={Boolean(errors.idCie10)}
              invalidText={errors.idCie10?.message}
            />
            {sugerirSubsecuente && (
              <div className="smo-sugerencia">
                <InlineNotification
                  kind="info"
                  lowContrast
                  hideCloseButton
                  title="Sugerencia"
                  subtitle={`${caso.cie10.codigo} coincide con el caso abierto: se sugiere «Subsecuente».`}
                />
                <Button
                  kind="tertiary"
                  size="sm"
                  onClick={() => setValue('tipoAtencion', 'subsecuente', opciones)}
                >
                  Cambiar a Subsecuente
                </Button>
              </div>
            )}

            {preguntaTrabajo && (
              <RadioButtonGroup
                legendText="¿Ocurrió en el trabajo?"
                name="ocurrioEnTrabajo"
                valueSelected={ocurrio === true ? 'si' : ocurrio === false ? 'no' : ''}
                onChange={(valor) => setValue('ocurrioEnTrabajo', valor === 'si', opciones)}
                invalid={Boolean(errors.ocurrioEnTrabajo)}
                invalidText={errors.ocurrioEnTrabajo?.message}
              >
                <RadioButton id="trabajo-si" labelText="Sí" value="si" />
                <RadioButton id="trabajo-no" labelText="No" value="no" />
              </RadioButtonGroup>
            )}

            {/* Signos vitales */}
            <Accordion>
              <AccordionItem title="Signos vitales (opcional)">
                <div className="smo-formulario__signos">
                  {CAMPOS_SIGNOS.map(({ nombre, etiqueta }) => (
                    <TextInput
                      key={nombre}
                      id={`signo-${nombre}`}
                      labelText={etiqueta}
                      inputMode="decimal"
                      invalid={Boolean(errors.signosVitales?.[nombre])}
                      invalidText={errors.signosVitales?.[nombre]?.message}
                      {...register(`signosVitales.${nombre}`)}
                    />
                  ))}
                </div>
                {alertasSignos.length > 0 && (
                  <InlineNotification
                    kind="warning"
                    lowContrast
                    hideCloseButton
                    title="Valores fuera de lo normal"
                    subtitle={alertasSignos.map((a) => a.mensaje).join(' · ')}
                  />
                )}
              </AccordionItem>
            </Accordion>

            <TextArea
              id="atencion-examen"
              labelText="Examen físico"
              rows={3}
              {...register('examenFisico')}
            />
            <TextArea
              id="atencion-tratamiento"
              labelText="Tratamiento"
              rows={2}
              {...register('tratamiento')}
            />
            <TextArea
              id="atencion-observaciones"
              labelText="Observaciones"
              rows={2}
              {...register('observaciones')}
            />

            {/* Receta */}
            <FormGroup legendText="Receta" className="smo-formulario__seccion">
              <Stack gap={5}>
                {filas.fields.map((fila, indice) => (
                  <FilaMedicamento
                    key={fila.id}
                    indice={indice}
                    elegido={medicamentos[String(filasReceta?.[indice]?.idMedicamento)]}
                    register={register}
                    errores={errors}
                    onElegir={(med) => {
                      if (med)
                        setMedicamentos((actuales) => ({ ...actuales, [String(med.id)]: med }));
                      setValue(
                        `receta.medicamentos.${indice}.idMedicamento`,
                        med?.id ?? (undefined as unknown as number),
                        opciones,
                      );
                    }}
                    onQuitar={() => filas.remove(indice)}
                  />
                ))}
                <div>
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={Add}
                    onClick={() =>
                      filas.append({
                        idMedicamento: undefined as unknown as number,
                        cantidad: '',
                        dosis: '',
                        frecuencia: '',
                        duracion: '',
                        indicaciones: '',
                      })
                    }
                  >
                    Agregar medicamento
                  </Button>
                </div>

                {alertasAlergia.length > 0 && (
                  <div className="smo-alerta-alergia">
                    <InlineNotification
                      kind="error"
                      role="alert"
                      lowContrast
                      hideCloseButton
                      title="Alerta de alergia"
                      subtitle={`El paciente tiene alergias registradas: ${paciente.alergias}. Coincide con: ${alertasAlergia
                        .map(
                          (a) =>
                            `${a.medicamento} (${a.por === 'grupo' ? 'grupo farmacológico' : 'nombre'})`,
                        )
                        .join(', ')}.`}
                    />
                    <Checkbox
                      id="recetar-de-todos-modos"
                      labelText="Recetar de todos modos"
                      checked={Boolean(recetarDeTodosModos)}
                      onChange={(_evento, { checked }) => {
                        setValue('receta.recetarDeTodosModos', checked);
                        if (checked) clearErrors('receta.recetarDeTodosModos');
                      }}
                      invalid={Boolean(errors.receta?.recetarDeTodosModos)}
                      invalidText={errors.receta?.recetarDeTodosModos?.message}
                    />
                  </div>
                )}

                <TextArea
                  id="receta-recomendaciones"
                  labelText="Recomendaciones"
                  rows={2}
                  invalid={Boolean(errors.receta?.recomendaciones)}
                  invalidText={errors.receta?.recomendaciones?.message}
                  {...register('receta.recomendaciones')}
                />
                <TextArea
                  id="receta-signos-alarma"
                  labelText="Signos de alarma"
                  rows={2}
                  {...register('receta.signosAlarma')}
                />
              </Stack>
            </FormGroup>

            {/* Certificado de reposo */}
            <FormGroup legendText="Certificado de reposo" className="smo-formulario__seccion">
              <Checkbox
                id="con-certificado"
                labelText="Emitir certificado de reposo"
                checked={conCertificado}
                onChange={(_evento, { checked }) => alternarCertificado(checked)}
              />
              {conCertificado && (
                <div className="smo-formulario__fila">
                  <TextInput
                    id="certificado-dias"
                    labelText="Días de reposo"
                    inputMode="numeric"
                    invalid={Boolean(errors.certificado?.dias)}
                    invalidText={errors.certificado?.dias?.message}
                    {...register('certificado.dias')}
                  />
                  <TextInput
                    id="certificado-inicio"
                    type="date"
                    labelText="Fecha de inicio"
                    invalid={Boolean(errors.certificado?.fechaInicio)}
                    invalidText={errors.certificado?.fechaInicio?.message}
                    {...register('certificado.fechaInicio')}
                  />
                  <p className="smo-formulario__calculado" aria-live="polite">
                    Fecha de fin: <strong>{fechaFin ? formatearDia(fechaFin) : '—'}</strong>
                  </p>
                </div>
              )}
            </FormGroup>

            <TextInput
              id="atencion-proxima-cita"
              type="date"
              labelText="Próxima cita (opcional)"
              invalid={Boolean(errors.proximaCita)}
              invalidText={errors.proximaCita?.message}
              {...register('proximaCita')}
            />
          </Stack>
        </form>
      </ModalBody>
      <ModalFooter className="smo-modal__pie">
        <Button kind="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button kind="primary" type="submit" form={FORMULARIO} disabled={isSubmitting}>
          {isSubmitting ? <InlineLoading description="Guardando…" /> : 'Guardar atención'}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
