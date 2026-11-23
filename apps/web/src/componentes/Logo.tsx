import { Link } from 'react-router';

interface LogoProps {
  /** Ruta a la que lleva el logo. */
  inicio: string;
}

/** Logo del encabezado. Reemplazar el texto por el SVG oficial de FIBERCOM cuando esté disponible. */
export function Logo({ inicio }: LogoProps) {
  return (
    <Link
      to={inicio}
      className="smo-logo"
      aria-label="FIBERCOM — Medicina Ocupacional, ir al inicio"
    >
      <span className="smo-logo__marca">FIBERCOM</span>
      <span className="smo-logo__sistema">Medicina Ocupacional</span>
    </Link>
  );
}
