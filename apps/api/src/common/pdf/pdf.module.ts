import { Global, Module } from '@nestjs/common';

import { PdfService } from './pdf.service.js';

/** Generador de PDF reutilizable (global). */
@Global()
@Module({ providers: [PdfService], exports: [PdfService] })
export class PdfModule {}
