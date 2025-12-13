
import { Controller, Get, UseGuards } from '@nestjs/common';
import { DebugService } from './debug.service';

// Basic security: you might want to add guards or only allow in dev/admin.
// For now, exposing it.
@Controller('debug')
export class DebugController {
    constructor(private readonly debugService: DebugService) { }

    @Get('graph')
    getGraph() {
        return this.debugService.getGraph();
    }
}
