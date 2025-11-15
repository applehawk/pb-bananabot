import { Injectable } from '@nestjs/common';
import { Tariff } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TariffService {
  constructor(private prisma: PrismaService) {}

  async getOneById(_id: string): Promise<Tariff> {
    return this.prisma.tariff.findUnique({ where: { id: _id } });
  }

  async getOneByName(name: string): Promise<Tariff> {
    return this.prisma.tariff.findFirst({ where: { name: name } });
  }

  async getAllTariffs(): Promise<Tariff[]> {
    return this.prisma.tariff.findMany({ orderBy: { price: 'desc' } });
  }

  async updateTariffPrice(name: string, price: number): Promise<Tariff> {
    return this.prisma.tariff.update({
      data: { price: price },
      where: { id: name },
    });
  }
}
