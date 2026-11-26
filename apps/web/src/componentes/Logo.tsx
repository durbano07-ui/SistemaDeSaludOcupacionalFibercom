import { Link } from 'react-router';

import logoFibercom from '../assets/logo-fibercom.png';

interface LogoProps {
  /** Ruta a la que lleva el logo; sin ella el logo no es un enlace (login, documentos). */
  inicio?: string;
  /** encabezado (32 px de alto), grande (pantalla de login) o documento (receta y certificado). */
  tamano?: 'encabezado' | 'grande' | 'documento';
}

/** Logo oficial de FIBERCOM con el nombre del sistema. */
export function Logo({ inicio, tamano = 'encabezado' }: LogoProps) {
  const clase = `smo-logo smo-logo--${tamano}`;
  const contenido = (
    <>
      <img className="smo-logo__imagen" src={logoFibercom} alt="" />
      <span className="smo-logo__sistema">Medicina Ocupacional</span>
    </>
  );
  if (!inicio) {
    return (
      <div className={clase} role="img" aria-label="FIBERCOM — Medicina Ocupacional">
        {contenido}
      </div>
    );
  }
  return (
    <Link to={inicio} className={clase} aria-label="FIBERCOM — Medicina Ocupacional, ir al inicio">
      {contenido}
    </Link>
  );
}
