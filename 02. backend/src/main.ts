import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('apiPrefix', 'api');
  const port = configService.get<number>('port', 3000);
  const corsOrigin = configService.get<string>('corsOrigin', '*');

  app.use(helmet());
  app.enableCors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',') });
  app.setGlobalPrefix(apiPrefix, { exclude: ['health', 'health/ready'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ligo Wallet Transaction Service')
    .setDescription(
      'Microservicio backend para gestionar operaciones de una billetera digital regulada: saldos, movimientos, débitos/créditos, transferencias y reversas.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Wallet Transaction Service listening on port ${port} (docs at /docs)`);
}

bootstrap();
