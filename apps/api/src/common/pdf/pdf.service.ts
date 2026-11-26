import { existsSync, readFileSync } from 'node:fs';

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer-core';

import { ENTORNO, type Entorno } from '../../config/entorno.js';

/** Rutas habituales de Chrome/Chromium si no se indica PUPPETEER_EXECUTABLE_PATH. */
const RUTAS_CHROME = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

const LOGO = `data:image/png;base64,${readFileSync(
  new URL('../../../assets/logo-fibercom.png', import.meta.url),
).toString('base64')}`;

export interface OpcionesPdf {
  /** A4 horizontal (registro mensual, informe trimestral) o vertical. */
  horizontal?: boolean;
  /** Texto a la izquierda del pie: fecha de generación y usuario. */
  pie: string;
}

const escaparPie = (texto: string) => texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Genera PDF desde plantillas HTML con Chrome sin interfaz (Puppeteer). Reutilizable por
 * reportes, receta, certificado e historia clínica. Usa UNA instancia del navegador, que se
 * lanza en el primer uso y se cierra al apagar la API.
 */
@Injectable()
export class PdfService implements OnApplicationShutdown {
  private readonly logger = new Logger(PdfService.name);
  private navegador?: Promise<Browser>;

  constructor(@Inject(ENTORNO) private readonly entorno: Entorno) {}

  /** Logo de FIBERCOM como data URI, para las plantillas. */
  static readonly logo = LOGO;

  private rutaChrome(): string {
    const ruta = this.entorno.PUPPETEER_EXECUTABLE_PATH ?? RUTAS_CHROME.find((r) => existsSync(r));
    if (!ruta) {
      throw new ServiceUnavailableException(
        'El generador de PDF no está disponible: no se encontró Chrome/Chromium (PUPPETEER_EXECUTABLE_PATH).',
      );
    }
    return ruta;
  }

  private obtenerNavegador(): Promise<Browser> {
    this.navegador ??= puppeteer
      .launch({
        executablePath: this.rutaChrome(),
        headless: true,
        args: [
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
          ...(this.entorno.PDF_SIN_SANDBOX ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
        ],
      })
      .then((navegador) => {
        // Si Chrome se cae, el próximo PDF lanza uno nuevo
        navegador.once('disconnected', () => {
          this.navegador = undefined;
        });
        return navegador;
      })
      .catch((error: unknown) => {
        this.navegador = undefined;
        throw error;
      });
    return this.navegador;
  }

  /** Renderiza el HTML en A4 con "Página X de Y" y el pie indicado. */
  async generar(html: string, opciones: OpcionesPdf): Promise<Buffer> {
    const pagina = await (await this.obtenerNavegador()).newPage();
    try {
      await pagina.setContent(html, { waitUntil: 'load' });
      const pdf = await pagina.pdf({
        format: 'A4',
        landscape: opciones.horizontal ?? false,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="width:100%;padding:0 10mm;font:8px Arial,sans-serif;color:#525252;display:flex;justify-content:space-between">
          <span>${escaparPie(opciones.pie)}</span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>`,
        margin: { top: '12mm', bottom: '16mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await pagina.close();
    }
  }

  /** Verificación para el panel del administrador: abre y cierra una página en blanco. */
  async verificar(): Promise<void> {
    const pagina = await (await this.obtenerNavegador()).newPage();
    await pagina.goto('about:blank');
    await pagina.close();
  }

  async onApplicationShutdown(): Promise<void> {
    const navegador = this.navegador;
    this.navegador = undefined;
    if (!navegador) return;
    try {
      await (await navegador).close();
    } catch (error) {
      this.logger.warn(`No se pudo cerrar Chrome: ${(error as Error).message}`);
    }
  }
}
