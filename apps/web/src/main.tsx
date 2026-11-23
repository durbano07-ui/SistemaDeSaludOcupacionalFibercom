import '@ibm/plex-sans/css/ibm-plex-sans-default.min.css';
import '@ibm/plex-mono/css/ibm-plex-mono-default.min.css';
import './estilos/global.scss';
import './lib/fecha';

import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { crearClienteConsultas } from './lib/consultas';
import { rutas } from './rutas';

const router = createBrowserRouter(rutas);
const clienteConsultas = crearClienteConsultas();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el elemento #raiz');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={clienteConsultas}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
