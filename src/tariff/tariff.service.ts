import { Injectable } from '@nestjs/common';
//import { InjectModel } from '@nestjs/mongoose';
//import { Model } from 'mongoose';
//import { Tariff, TariffDocument } from './schemas/tariff.schema';
import { Prisma, Tariff } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TariffService {
    constructor(private prisma: PrismaService) {}

    async getOneById(_id: string): Promise<Tariff> {
        /**
         *       id: string
      name: string
      connectionsLimit: number
      price: number
         */
        //return this.prisma.tariff.findUnique({ where: { id: _id } })
        return { id: "1", name: "FREE", connectionsLimit:1, price: 0.0 }
    }

    async getOneByName(name: string): Promise<Tariff> {
        //return this.prisma.tariff.findFirst({ where: { name: name} });
        return { id: "1", name: "FREE", connectionsLimit:1, price: 0.0 }
    }

    async getAllTariffs(): Promise<Tariff[]> {
        return this.prisma.tariff.findMany({ orderBy: { price: 'desc'} })
    }
  //constructor(@InjectModel(Tariff.name) private readonly tariffModel: Model<TariffDocument>) {}

  //async getOneById(_id: string): Promise<TariffDocument> {
  //  return this.tariffModel.findById(_id);
  //}

  //async getOneByName(name: string): Promise<TariffDocument> {
  //  return this.tariffModel.findOne({ name });
  //}

  //async getAllTariffs(): Promise<TariffDocument[]> {
  //  return this.tariffModel.find().sort({ price: 1 }).exec();
  //}
}
