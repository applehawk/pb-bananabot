import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { User, Connection } from '@prisma/client';
import { ConnectionService } from 'src/prisma/connection.service';
import { UserService } from 'src/prisma/user.service';

interface OutlineSSConnection {
    serverAddress: string,
    port: string,
    encrypt_method: string,
    password: string,
    accessUrl: string
}

@Injectable()
export class OutlineService {
    readonly apiUrl: string
    readonly vpnDomain: string
    readonly outlineUsersGateway: string = "users.outline.yourvpn.io"
    readonly version: string = "v1"

    constructor(
        private readonly configService: ConfigService,
        private readonly userService: UserService,
        private readonly connService: ConnectionService,
        private readonly httpService: HttpService
      ) {
        this.apiUrl = this.configService.get<string>('OUTLINE_API_URL')
        this.vpnDomain = this.configService.get<string>('VPN_SERVER')
        this.outlineUsersGateway = this.vpnDomain

        console.log('OUTLINE_API_URL: ' + this.apiUrl)
        console.log('VPN_SERVER: ' + this.vpnDomain)
    }

    getOutlineDynamicLink(connection: Connection) {
        //telegramId: string | number, connName: string, connId: number
        let tgIdHex: string = (+connection.tgid).toString(16)
        let connIdHex: string = (+connection.key_id).toString(16)
        let connName: string = connection.name
  
        return `ssconf://${this.outlineUsersGateway}/conf/${this.version}/${tgIdHex}/${connIdHex}/${connName}`
    }

    getConnectionRedirectLink(connection: Connection) {
        let tgIdHex: string = (+connection.tgid).toString(16)
        let connIdHex: string = (+connection.key_id).toString(16)
        let connName: string = connection.name

        return `https://${this.outlineUsersGateway}/redirect/${this.version}/${tgIdHex}/${connIdHex}/${connName}`
    }

    async createConnection(tgid: number, connName: string) : Promise<Connection> {
        return this.userService
        .userFirst({where: {tgid: tgid}})
        .then(
            user => this.userService.limitExceedWithUser(user)
            .then(
                isExceed => {
                    console.log(`isExceed = ${isExceed}`)
                    return isExceed == false ? 
                    this.createNewKey(tgid)
                        .then(newKey => this.parseOutlineAccessUrl(newKey.accessUrl))
                        .then(newConn => this.connService.createConnectionEntryWithOutlineConn(user, connName, newConn))
                    : Promise.reject("Limit exceed")
                }
            )
        )
    }
    
    private parseOutlineAccessUrl(accessUrl: string) : OutlineSSConnection {
        console.log(accessUrl)
        let regexKey = /ss:\/\/(\w+)@(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}):(\w+)\//g
        let [ regexKeyMatch, encodedBase64Key, serverAddress, port ] = [...accessUrl.matchAll(regexKey)][0]
        console.log(`url64code: ${encodedBase64Key}, serverAddress: ${serverAddress}, port: ${port}`)
        let decodedBase64Key: string = atob(encodedBase64Key);
        let regexBase64Key = /(.+):(.+)/g
        let [ regexBase64KeyMatch, encrypt_method, password ] = [...decodedBase64Key.matchAll(regexBase64Key)][0]
        let outlineConn: OutlineSSConnection = { serverAddress: serverAddress, port: port, encrypt_method: encrypt_method, password: password, accessUrl: accessUrl }
    
        return outlineConn
    }


    // Management API Outline
    private async renameKey(keyId: string | number, keyName: string) {
        const url = `${this.apiUrl}/access-keys/${keyId}/name`;
        return this.httpService.axiosRef.put(url, { "name": keyName });
    }
    private async createNewKey(withTelegramId: number) : Promise<any> {
        let url = `${this.apiUrl}/access-keys`;
        let tgIdStr = withTelegramId.toString()
        return this.httpService.axiosRef.post(url)
            .then(
                response => this.renameKey(response.data.id, tgIdStr)
                .then(_ => response.data)
            )
    }
}
