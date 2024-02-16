import { Controller, Post, Get, Req, Res, Query, HttpStatus, Body, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { config } from 'process';
import { AxiosRequestConfig } from 'axios';

import { Connection } from '@prisma/client';
import { User } from '@prisma/client';
import { ConnectionService } from 'src/prisma/connection.service';

const OUTLINE_USERS_GATEWAY = "ssconf://users.outline.yourvpn.io"
const OUTLINE_SALT = "qwerty123"
const CONN_NAME = "Wow!"

type JSONValue =
    | string
    | number
    | boolean
    | { [x: string]: JSONValue }
    | Array<JSONValue>;

@Controller('outline')
export class OutlineBackendController {
    apiUrl: string
    vpnDomain: string

    outlineUsersGateway: string = "ssconf://users.outline.yourvpn.io"
    outlineSalt: string = "qwerty123"
    connName: string = "Wow!"

    constructor(
        private configService: ConfigService, 
        private readonly httpService: HttpService, 
        private connectionService: ConnectionService) {   
            this.apiUrl = this.configService.get<string>('OUTLINE_API_URL')
            this.vpnDomain = this.configService.get<string>('VPN_SERVER')
            this.outlineUsersGateway = "ssconf://" + this.vpnDomain
            console.log('OUTLINE_API_URL: ' + this.apiUrl)
            console.log('VPN_SERVER: ' + this.vpnDomain)
    }

    @Post(':id') //name = telegramId
    create(@Res() res: Response, @Param('id') telegramId: string) {
        const keyId = this.createNewKey(telegramId)
        res.status(HttpStatus.OK).json({"key_id": keyId});
    }

    @Get('/dynamic/:telegramId')
    getOutlineDynamicLink(@Param('telegramId') telegramId: string | number) {
        let userIdNumber: number = +telegramId
        let userIdHex: string = '0x'+userIdNumber.toString(16);
        console.log(userIdHex)
        return `${this.outlineUsersGateway}/conf/${this.outlineSalt}${userIdHex}#${this.connName}`
    }

    @Get('/conf/:hexId')
    handleConfig(@Param('hexId') hexId: string) {
        let userId = parseInt(hexId, 16)
        //const result = await this.userConnectionService.connection({ id: string(userId) })
    }

    async renameKey(keyId: string | number, keyName: string) {
        const url = `${this.apiUrl}/access-keys/${keyId}/name`;
        return this.httpService.axiosRef.put(url, { "name": keyName });
    }

    async createNewKey(withTelegramId: string) {
        let url = `${this.apiUrl}/access-keys`;
        console.log(url)
        let response = await this.httpService.axiosRef.post(url);
        let keyId: string = response.data.id
        await this.renameKey(keyId, withTelegramId)

        console.log(response.data)

        let server_port: number = response.data.port
        let password: string = response.data.password
        let method: string  = response.data.method
        let accessUrl: string = response.data.accessUrl

        this.connectionService.createConnection({ 
            tgid: withTelegramId, 
            name: withTelegramId,
            server: this.vpnDomain,
            server_port: server_port,
            password: password,
            method: method,
            access_url: accessUrl,
        });

        return response.data;
    }
}
