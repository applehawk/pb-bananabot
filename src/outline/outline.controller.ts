import { Controller, Post, Get, Req, Res, Query, HttpStatus, Body, Param } from '@nestjs/common';
import { Response } from 'express';
import { ConnectionService } from 'src/prisma/connection.service';
import { UserService } from 'src/user/user.service';
import { OutlineService } from 'src/outline/outline.service';

const CONNLIMIT = 1

@Controller()
export class OutlineController {
    constructor(
        private connService: ConnectionService,
        private outlineService: OutlineService,
        private userService: UserService) {   
    }

    @Post('/user/:userId') //name = telegramId
    async createUser(@Res() res: Response, 
        @Param('userId') userIdStr: string, 
        @Query('firstname') firstname: string,
        @Query('lastname') lastname?: string,
        @Query('nickname') nickname?: string) 
    {
        const userId = parseInt(userIdStr)
        return this.userService.upsert({
            userId: userId,
            firstname: firstname, 
            lastname: lastname,
            nickname: nickname,
            chatId: 0,
            connLimit: CONNLIMIT
        }).then(user => {
            res.status(HttpStatus.OK).json({
                "id": user.userId,
                "firstname": user.firstname,
                "lastname": user.lastname,
                "nickname": user.nickname,
                "connLimit": user.connLimit
            });
        })
    }

    @Get('/redirect/:version/:connIdHex/:connName')
    async getConnection(@Res() res: Response,
        @Param('version') version: string,
        @Param('connIdHex') connIdHex: string,
        @Param('connName') connName: string) 
    {
        let connId = parseInt(connIdHex)
                
        return this.connService.connection( {id: connId} )
        .then( connection => {
            res.status(HttpStatus.OK).json(
                {
                    "url": `${this.outlineService.getOutlineDynamicLink(connection)}`,
                    "status": 302,
                }
            )
        })
    }

    @Post('/user/:userId/conn/:connName')
    async createConnection(@Res() res: Response,
        @Param('userId') userIdStr: string, 
        @Param('connName') connName: string,
        @Query('lastConn') lastConn: boolean) {
        const userId = parseInt(userIdStr)
        return this.userService.findOneByUserId(userId)
        .then(user => {
            console.log(`User found: ${user}`)
            return user !== null ? user : Promise.reject("UserNotFound")
        })
        .then( user => this.outlineService.createConnection(userId, connName))
        .then( newConn => {
            res.status(HttpStatus.OK).json(
                {
                    "link": `${this.outlineService.getOutlineDynamicLink(newConn)}`
                }
            )
        })
        .catch( (reason) => {
            return this.connService.connections({where: {userId: userId}})
            .then( connections => connections.reduce((acc, curr) => curr, null) )
            .then( lastConnection => {
                const outlineLink = this.outlineService.getOutlineDynamicLink(lastConnection)
                console.log(`Reason: ${reason}`)
                var jsonResponse = Object.assign({}, {"warning": reason}, lastConn ? {"link": outlineLink} : {})
                res.status(HttpStatus.NOT_FOUND).json(jsonResponse)
            })
        })
    }

    @Get('/conf/:version/:connIdHex/:connName')
    async handleConfig(@Res() res: Response, 
    @Param('version') version: string,
    @Param('connIdHex') connIdHex: string) {

        let connId = parseInt(connIdHex, 16)

        this.connService.connectionFirst({
            where:{ id: connId }
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
