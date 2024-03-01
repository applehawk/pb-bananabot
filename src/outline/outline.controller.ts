import { Controller, Post, Get, Req, Res, Query, HttpStatus, Body, Param } from '@nestjs/common';
import { Response } from 'express';
import { ConnectionService } from 'src/prisma/connection.service';
import { UserService } from 'src/prisma/user.service';
import { OutlineService } from 'src/outline/outline.service';

const CONNLIMIT = 1

@Controller()
export class OutlineController {
    constructor(
        private connService: ConnectionService,
        private outlineService: OutlineService,
        private userService: UserService) {   
    }

    @Post('/user/:id') //name = telegramId
    async createUser(@Res() res: Response, 
        @Param('id') tgid: string, 
        @Query('firstname') firstname: string,
        @Query('lastname') lastname?: string,
        @Query('nickname') nickname?: string) 
    {
        var tgidInt = parseInt(tgid)
        return this.userService.upsert({
            tgid: tgidInt,
            firstname: firstname, 
            lastname: lastname,
            nickname: nickname,
            chatId: 0,
            connLimit: CONNLIMIT
        }).then(user => {
            res.status(HttpStatus.OK).json({
                "id": user.tgid,
                "firstname": user.firstname,
                "lastname": user.lastname,
                "nickname": user.nickname,
                "connLimit": user.connLimit
            });
        })
    }

    @Post('/user/:id/conn/:connName')
    async createConnection(@Res() res: Response,
        @Param('id') tgid: string, 
        @Param('connName') connName: string,
        @Query('lastConn') lastConn: boolean) {
        let tgidInt = parseInt(tgid)
        
        return this.userService.findOneByUserId(tgidInt)
        .then(user => {
            console.log(`User found: ${user}`)
            return user !== null ? user : Promise.reject("UserNotFound")
        })
        .then( user => this.outlineService.createConnection(tgidInt, connName))
        .then( newConn => {
            res.status(HttpStatus.OK).json(
                {
                    "link": `${this.outlineService.getOutlineDynamicLink(newConn)}`
                }
            )
        })
        .catch( (reason) => {
            return this.connService.connections({where: {tgid: tgidInt}})
            .then( connections => connections.reduce((acc, curr) => curr, null) )
            .then( lastConnection => {
                const outlineLink = this.outlineService.getOutlineDynamicLink(lastConnection)
                console.log(`Reason: ${reason}`)
                var jsonResponse = Object.assign({}, {"warning": reason}, lastConn ? {"link": outlineLink} : {})
                res.status(HttpStatus.NOT_FOUND).json(jsonResponse)
            })
        })
    }

    @Get('/conf/:version/:tgIdHex/:connIdHex/:connName')
    async handleConfig(@Res() res: Response, @Param('version') version: string,
        @Param('tgIdHex') tgIdHex: string, @Param('connIdHex') connIdHex: string) {

        let tgId = parseInt(tgIdHex, 16)
        let connId = parseInt(connIdHex, 16)

        this.connService.connectionFirst({
            where:{ tgid: tgId }
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
}
