import { Link } from 'react-router';

interface LogoProps {
  /** Ruta a la que lleva el logo; sin ella el logo no es un enlace (pantalla de login). */
  inicio?: string;
}

/** Logo del sistema. Reemplazar el texto por el SVG oficial de FIBERCOM cuando esté disponible. */
export function Logo({ inicio }: LogoProps) {
  const contenido = (
    <>
      <span className="smo-logo__marca">FIBERCOM</span>
      <span className="smo-logo__sistema">Medicina Ocupacional</span>
    </>
  );
  if (!inicio) {
    return (
      <div className="smo-logo" role="img" aria-label="FIBERCOM — Medicina Ocupacional">
        {contenido}
      </div>
    );
  }
  return (
    <Link
      to={inicio}
      className="smo-logo"
      aria-label="FIBERCOM — Medicina Ocupacional, ir al inicio"
    >
      {contenido}
    </Link>
  );
}
