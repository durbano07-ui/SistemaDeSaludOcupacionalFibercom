import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'smo:publico';

/** Marca una ruta (o un controlador) que no exige access token. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
