import { Module } from '@nestjs/common';
//import { MongooseModule } from '@nestjs/mongoose';
//import { Tariff, TariffSchema } from './schemas/tariff.schema';
import { Tariff } from '@prisma/client';
import { TariffService } from './tariff.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  //imports: [MongooseModule.forFeature([{ name: Tariff.name, schema: TariffSchema }])],
  providers: [TariffService],
  exports: [TariffService],
})
export class TariffModule {}
