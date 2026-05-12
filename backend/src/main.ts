import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {//这里的bootstrap是入口函数
  const app = await NestFactory.create(AppModule)
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()).filter(Boolean)
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : false
  })
  app.setGlobalPrefix('api/v1')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,//过滤掉不在DTO中定义的字段
      transform: true// 
    })
  )
  const port = Number(process.env.PORT || 8000)
  await app.listen(port, '0.0.0.0')
}

bootstrap()
