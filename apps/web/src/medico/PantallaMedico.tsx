import { Report, UserMultiple } from '@carbon/icons-react';
import {
  Button,
  InlineNotification,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tile,
} from '@carbon/react';
import type { AtencionRegistrada } from '@smo/shared';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { usePermiso } from '../auth/useAuth';
import { SinPermiso } from '../componentes/SinPermiso';
import { useResumenPaciente } from '../lib/consultas-medico';
import { ModalBuscarPaciente } from './ModalBuscarPaciente';
import { ModalNuevaAtencion } from './ModalNuevaAtencion';
import { PestanaAtenciones } from './PestanaAtenciones';
import { PestanaConsultasAnteriores } from './PestanaConsultasAnteriores';
import { TarjetaPaciente } from './TarjetaPaciente';

function ProximoModulo() {
  return <p className="smo-vacio">Disponible en el próximo módulo</p>;
}

/** Pantalla del médico: tarjeta del paciente, acciones y pestañas. */
export function PantallaMedico() {
  const verDatosClinicos = usePermiso('datos_clinicos');
  const verReportes = usePermiso('reportes');
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const idPaciente = Number(parametros.get('paciente')) || null;
  const resumen = useResumenPaciente(verDatosClinicos ? idPaciente : null);
  const [buscando, setBuscando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [registrada, setRegistrada] = useState<AtencionRegistrada | null>(null);

  if (!verDatosClinicos && !verReportes) {
    return (
      <SinPermiso mensaje="Todavía no tienes opciones habilitadas. Pide al administrador los permisos que necesitas." />
    );
  }

  const seleccionar = (id: number) => {
    setParametros({ paciente: String(id) });
    setBuscando(false);
    setRegistrada(null);
  };
  const paciente = resumen.data;

  return (
    <div className="smo-medico">
      {verDatosClinicos && (
        <aside className="smo-medico__tarjeta">
          <TarjetaPaciente
            paciente={paciente}
            cargando={idPaciente !== null && resumen.isPending}
            error={resumen.isError}
          />
        </aside>
      )}

      <div className="smo-medico__principal">
        <Tile className="smo-contenedor smo-acciones">
          {verDatosClinicos && (
            <Button renderIcon={UserMultiple} onClick={() => setBuscando(true)}>
              Pacientes
            </Button>
          )}
          {verReportes && (
            <Button
              kind="tertiary"
              renderIcon={Report}
              onClick={() => void navegar('/medico/reportes')}
            >
              Reportes
            </Button>
          )}
        </Tile>

        {registrada && (
          <InlineNotification
            kind="success"
            lowContrast
            role="status"
            title={`Atención ${registrada.codigo} registrada`}
            subtitle={[
              registrada.codigoCertificado ? `Certificado ${registrada.codigoCertificado}.` : '',
              registrada.advertencias.signosVitales.length
                ? `Signos vitales fuera de lo normal: ${registrada.advertencias.signosVitales.map((a) => a.mensaje).join(', ')}.`
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClose={() => setRegistrada(null)}
          />
        )}

        {paciente && (
          <Tile className="smo-contenedor smo-pestanas">
            <Tabs>
              <TabList aria-label="Secciones del paciente" contained={false}>
                <Tab>Atenciones</Tab>
                <Tab>Historia clínica</Tab>
                <Tab>Fichas y matrices</Tab>
                <Tab>Consultas anteriores</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <PestanaAtenciones
                    paciente={paciente}
                    onNuevaAtencion={() => setRegistrando(true)}
                  />
                </TabPanel>
                <TabPanel>
                  <ProximoModulo />
                </TabPanel>
                <TabPanel>
                  <ProximoModulo />
                </TabPanel>
                <TabPanel>
                  <PestanaConsultasAnteriores key={paciente.id} idPaciente={paciente.id} />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Tile>
        )}
      </div>

      <ModalBuscarPaciente
        abierto={buscando}
        onCerrar={() => setBuscando(false)}
        onSeleccionar={seleccionar}
      />
      {registrando && paciente && (
        <ModalNuevaAtencion
          paciente={paciente}
          onCerrar={() => setRegistrando(false)}
          onGuardada={(atencion) => {
            setRegistrando(false);
            setRegistrada(atencion);
          }}
        />
      )}
    </div>
  );
}
