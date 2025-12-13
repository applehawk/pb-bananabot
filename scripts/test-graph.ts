
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory, ModulesContainer } from '@nestjs/core';
import { BotModule } from '../src/grammy/bot.module';
import { SpelunkerModule } from 'nestjs-spelunker';
import { Logger } from '@nestjs/common';
import { DebugService } from '../src/debug/debug.service';

async function bootstrap() {
    console.log('Testing Spelunker Graph Generation...');
    let app;
    try {
        app = await NestFactory.create(BotModule, { logger: false });

        // Test Spelunker
        // Validating structure
        const modulesContainer = app.get(ModulesContainer);
        const modules = [...modulesContainer.values()];

        const paymentModuleRef = modules.find(m => m.metatype.name === 'PaymentModule');
        if (paymentModuleRef) {
            console.log('Found PaymentModule in Container');
            const providers = [...paymentModuleRef.providers.values()];
            const paymentServiceProvider = providers.find(p => p.name === 'PaymentService' || (typeof p.token === 'function' && p.token.name === 'PaymentService'));

            if (paymentServiceProvider) {
                console.log('Found PaymentService Provider');
                // Standard providers usually have 'metatype' as the class.
                // InstanceWrapper has .metatype
                const metatype = paymentServiceProvider.metatype;
                if (metatype) {
                    const paramTypes = Reflect.getMetadata('design:paramtypes', metatype);
                    if (paramTypes) {
                        console.log('✅ Found param types via ModulesContainer:', paramTypes.length);
                        paramTypes.forEach((type: any, index: number) => {
                            console.log(`Arg ${index}: ${type.name}`);
                        });
                    } else {
                        console.log('❌ No param types on metatype.');
                    }
                }
            }
        }


        const debugService = app.get(DebugService);
        // We are just inspecting for now, not asserting debugService state since we didn't inject the tree into it in THIS script manually if we don't assume main.ts logic runs (which it doesn't here).
        // Wait, main-grammy.ts has the logic to inject. IN THIS script we replicate it.

        const tree = SpelunkerModule.explore(app);
        const root: any = SpelunkerModule.graph(tree);
        debugService.setGraph(root);

        const storedGraph = debugService.getGraph();
        if (storedGraph) {
            console.log('✅ DebugService works!');
        } else {
            console.error('❌ DebugService failed.');
        }

        await app.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Validation Failed!');
        console.error(error);
        if (app) await app.close();
        process.exit(1);
    }
}

bootstrap();
