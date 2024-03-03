import { Controller, Post, Get, Req, Res, Query, HttpStatus, Body, Param } from '@nestjs/common';
import { Response } from 'express';
import { ConnectionService } from 'src/prisma/connection.service';
import { OutlineService } from 'src/outline/outline.service';

const CONNLIMIT = 1

@Controller()
export class OutlineController {
    constructor(
        private connService: ConnectionService,
        private outlineService: OutlineService) {   
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
                return res.redirect(`${this.outlineService.getOutlineDynamicLink(connection)}`);
            }).catch( (reason) => {
                return res.status(HttpStatus.NOT_FOUND)
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
