import { Search as IconoBuscar } from '@carbon/icons-react';
import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextInput,
} from '@carbon/react';
import { useState } from 'react';

import { useBusquedaPacientes, useRetardado } from '../lib/consultas-medico';

interface ModalBuscarPacienteProps {
  abierto: boolean;
  onCerrar: () => void;
  onSeleccionar: (idPaciente: number) => void;
}

/** Modal "Pacientes": búsqueda en vivo (desde 2 caracteres, 300 ms) y selección. */
export function ModalBuscarPaciente({
  abierto,
  onCerrar,
  onSeleccionar,
}: ModalBuscarPacienteProps) {
  const [texto, setTexto] = useState('');
  const [inmediato, setInmediato] = useState<string | null>(null);
  const retardado = useRetardado(texto, 300);
  // Enter o "Buscar" buscan sin esperar los 300 ms
  const termino = (inmediato ?? retardado).trim();
  const consulta = useBusquedaPacientes(termino);
  const escribiendo = texto.trim() !== termino && texto.trim().length >= 2;

  const buscarYa = () => setInmediato(texto);
  const resultados = consulta.data ?? [];

  return (
    <ComposedModal
      open={abierto}
      onClose={onCerrar}
      size="md"
      className="smo-modal"
      aria-label="Pacientes"
    >
      <ModalHeader title="Pacientes" closeModal={onCerrar} iconDescription="Cerrar" />
      <ModalBody>
        <form
          role="search"
          className="smo-busqueda"
          onSubmit={(evento) => {
            evento.preventDefault();
            buscarYa();
          }}
        >
          <TextInput
            id="buscar-paciente"
            labelText="Buscar por cédula, nombres o apellidos"
            placeholder="Escribe al menos 2 caracteres"
            value={texto}
            autoComplete="off"
            data-modal-primary-focus
            onChange={(evento) => {
              setTexto(evento.target.value);
              setInmediato(null);
            }}
          />
          <Button type="submit" kind="primary" size="md" renderIcon={IconoBuscar}>
            Buscar
          </Button>
        </form>

        <div className="smo-busqueda__estado" aria-live="polite">
          {texto.trim().length < 2 ? (
            <p className="smo-ayuda">Escribe al menos 2 caracteres para buscar.</p>
          ) : escribiendo || consulta.isFetching ? (
            <InlineLoading description="Buscando…" />
          ) : consulta.isError ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title="No se pudo buscar"
              subtitle="Revisa tu conexión e inténtalo de nuevo."
            />
          ) : consulta.isSuccess && resultados.length === 0 ? (
            <p className="smo-ayuda">Sin resultados para «{termino}».</p>
          ) : null}
        </div>

        {resultados.length > 0 && !escribiendo && (
          <div className="smo-tabla-desplazable">
            <Table size="md" aria-label="Pacientes encontrados">
              <TableHead>
                <TableRow>
                  <TableHeader>Apellidos y nombres</TableHeader>
                  <TableHeader>Base</TableHeader>
                  <TableHeader>
                    <span className="cds--visually-hidden">Acción</span>
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {resultados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.apellidos} {p.nombres}
                    </TableCell>
                    <TableCell>{p.base}</TableCell>
                    <TableCell className="smo-celda-accion">
                      <Button
                        size="sm"
                        kind="tertiary"
                        aria-label={`Seleccionar a ${p.apellidos} ${p.nombres}`}
                        onClick={() => onSeleccionar(p.id)}
                      >
                        Seleccionar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ModalBody>
    </ComposedModal>
  );
}
