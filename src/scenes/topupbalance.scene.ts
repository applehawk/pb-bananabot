import { Scene, Ctx } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';

@Scene(CommandEnum.TOPUP_BALANCE)
export class TopupBalanceScene extends AbstractScene {}
