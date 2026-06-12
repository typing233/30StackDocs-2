import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // OpenAPI / Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('StackDocs API')
    .setDescription('StackDocs documentation platform REST API')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'Authorization', description: 'API Token (prefix: sd_)' }, 'api-token')
    .addTag('auth', 'Authentication endpoints')
    .addTag('books', 'Book management')
    .addTag('chapters', 'Chapter management')
    .addTag('pages', 'Page management')
    .addTag('search', 'Full-text search')
    .addTag('exports', 'Export management')
    .addTag('permissions', 'Permission & ABAC policy management')
    .addTag('tokens', 'API token management')
    .addTag('config', 'System configuration')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API server running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
