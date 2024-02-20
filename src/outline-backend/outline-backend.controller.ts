import { Controller, Post, Get, Req, Res, Query, HttpStatus, Body, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Response } from 'express';
import { config } from 'process';
import { AxiosRequestConfig } from 'axios';

import { Connection } from '@prisma/client';
import { ConnectionService } from 'src/prisma/connection.service';
import { User } from '@prisma/client';
import { UserService } from 'src/prisma/user.service';
import { retry } from 'rxjs';
import { PrismaClient, Prisma } from '@prisma/client'

type JSONValue =
    | string
    | number
    | boolean
    | { [x: string]: JSONValue }
    | Array<JSONValue>;

const CONNLIMIT = 1

@Controller()
export class OutlineBackendController {
    apiUrl: string
    vpnDomain: string

    outlineUsersGateway: string = "ssconf://users.outline.yourvpn.io"
    version: string = "v1"
    connName: string = "Wow!"

    constructor(
        private configService: ConfigService, 
        private readonly httpService: HttpService, 
        private connectionService: ConnectionService,
        private userService: UserService) {   
            this.apiUrl = this.configService.get<string>('OUTLINE_API_URL')
            this.vpnDomain = this.configService.get<string>('VPN_SERVER')
            this.outlineUsersGateway = "ssconf://" + this.vpnDomain
            console.log('OUTLINE_API_URL: ' + this.apiUrl)
            console.log('VPN_SERVER: ' + this.vpnDomain)
    }

    @Post('/user/:id') //name = telegramId
    async createUser(@Res() res: Response, @Param('id') telegramId: string, 
        @Query('firstname') firstname: string,
        @Query('lastname') lastname?: string,
        @Query('nickname') nickname?: string) {
        var user = null
        try {
            user = await this.userService.userFirst({ 
                where: { id: telegramId }
            })
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError) {
                if (e.code === 'P2021') {
                    console.log(
                    'The table {table} does not exist in the current database.'
                    )
                }
            }
        }
        if (user === null) {
            user = await this.userService.createUser({
                id: telegramId,
                firstname: firstname,
                lastname: lastname,
                nickname: nickname,
                connLimit: CONNLIMIT
            })
        }
        res.status(HttpStatus.OK).json({
            "id": user.id,
            "firstname": user.firstname,
            "lastname": user.lastname,
            "nickname": user.nickname,
            "connLimit": user.connLimit
        });
    }

    @Post('/user/:id/conn/:connName')
    async createConnection(@Res() res: Response, @Param('id') telegramId: string, @Param('connName') connName: string) {
        let user = await this.userService.userFirst({ 
            where: { id: telegramId }
        })
        if (user === null) {
            res.status(HttpStatus.NOT_FOUND).json({ "id": "UserNotFound"})
            return
        }
        let connections = await this.connectionService.connections({ where: { userKey_id: user.key_id }})
        if (connections.length >= user.connLimit) {
            res.status(HttpStatus.NOT_FOUND).json({ "id": "ConnectionLimitExceed"})
            return
        }
        
        let response = await this.createNewKey(telegramId)

        let regexKey = /ss:\/\/(\w+)@(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}):(\w+)\//g
        let [ encodedBase64Key, serverAddress, port ] = [...response.accessUrl.matchAll(regexKey)][0]
        console.log(`url64code: ${encodedBase64Key}, serverAddress: ${serverAddress}, port: ${port}`)
        let decodedBase64Key: string = atob(encodedBase64Key);
        let regexBase64Key = /(.+):(.+)/g
        let [ encrypt_method, password ] = [...decodedBase64Key.matchAll(regexBase64Key)][0]
        
        let newConnection = await this.connectionService.createConnection({
            tgid: telegramId,
            name: connName,
            server: serverAddress,
            server_port: port,
            method: encrypt_method,
            access_url: response.accessUrl,
            password: password
        })
        let dynamicLink = this.getOutlineDynamicLink(telegramId, connName, newConnection.key_id)
        res.status(HttpStatus.OK).json({ "link": dynamicLink})
    }

    @Get('/conf/:version/:tgIdHex/:connIdHex/:connName')
    async handleConfig(@Res() res: Response, @Param('version') version: string,
        @Param('tgIdHex') tgIdHex: string, @Param('connIdHex') connIdHex: string) {

        let tgId = parseInt(tgIdHex, 16)
        let connId = parseInt(connIdHex, 16)

        this.connectionService.connectionFirst({
            where:{ tgid: tgId.toString() }
        }).then( connection => {
            res.status(HttpStatus.OK).json({
                "server": connection.server,
                "server_port": connection.server_port,
                "password": connection.password,
                "method": connection.method
            })
        }).catch( error => {
            res.status(HttpStatus.NOT_FOUND);
        })
    }

    getOutlineDynamicLink(telegramId: string | number, connName: string, connId: number) {
        let tgIdHex: string = (+telegramId).toString(16)
        let connHex: string = connId.toString(16)
        return`${this.outlineUsersGateway}/conf/${this.version}/${tgIdHex}/${connHex}/${connName}`
    }
// Management API Outline
    async renameKey(keyId: string | number, keyName: string) {
        const url = `${this.apiUrl}/access-keys/${keyId}/name`;
        return this.httpService.axiosRef.put(url, { "name": keyName });
    }
    async createNewKey(withTelegramId: string) {
        let url = `${this.apiUrl}/access-keys`;
        let response = await this.httpService.axiosRef.post(url);

        let keyId: string = response.data.id
        await this.renameKey(keyId, withTelegramId)

        console.log(response.data)
        return response.data;
    }
}
