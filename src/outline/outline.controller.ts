import { Controller, Post, Get, Req, Res, Query, HttpStatus, Body, Param } from '@nestjs/common';
import { Response } from 'express';
import { ConnectionService } from 'src/prisma/connection.service';
import { OutlineService } from 'src/outline/outline.service';
import { UserService } from 'src/user/user.service';

const CONNLIMIT = 1

@Controller()
export class OutlineController {
    constructor(
        private connService: ConnectionService,
        private outlineService: OutlineService,
        private userService: UserService) {   
    }

    @Get('/redirect/:version/:connIdHex/:connName')
    async getConnection(@Res() res: Response,
        @Param('version') version: string,
        @Param('connIdHex') connIdHex: string,
        @Param('connName') connName: string) 
    {           
        return this.connService.connection( {hashId: connIdHex} )
            .then( connection => {
                return res.redirect(`${this.outlineService.getOutlineDynamicLink(connection)}`);
            }).catch( (reason) => {
                return res.status(HttpStatus.NOT_FOUND)
            })
    }

    @Get('/conf/:version/:connIdHex/:connName')
    async handleConfig(@Res() res: Response, 
    @Param('version') version: string,
    @Param('connIdHex') connIdHex: string) {

        return this.connService.connectionFirst({
            where:{ hashId: connIdHex }
        }).then( connection => {
            return this.userService.findOneByUserId(connection.userId).then( user => {
                res.status(HttpStatus.OK).json({
                    "server": connection.server,
                    "server_port": connection.server_port,
                    "password": connection.password,
                    "method": connection.method
                })
            })
        }).catch( error => {
            res.status(HttpStatus.NOT_FOUND);
        })
    }
}
