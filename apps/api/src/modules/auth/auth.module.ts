import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';

import { ENTORNO, type Entorno } from '../../config/entorno.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { ContrasenasService } from './contrasenas.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermisosGuard } from './guards/permisos.guard.js';
import { SesionesTarea } from './sesiones.tarea.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENTORNO],
      useFactory: (entorno: Entorno) => ({
        secret: entorno.JWT_SECRET,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: entorno.JWT_EXPIRES_IN as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    // Límite del login: 10 peticiones por minuto por IP (se aplica solo donde se usa ThrottlerGuard).
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'login', ttl: 60_000, limit: 10 }],
      errorMessage: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ContrasenasService,
    SesionesTarea,
    // El orden importa: primero se autentica, después se verifican los permisos.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
  exports: [AuthService, ContrasenasService],
})
export class AuthModule {}
