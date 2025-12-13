
import { Injectable } from '@nestjs/common';

@Injectable()
export class DebugService {
    private graphData: any = {};

    setGraph(data: any) {
        this.graphData = data;
    }

    getGraph() {
        return this.graphData;
    }
}
