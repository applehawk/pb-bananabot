
import 'reflect-metadata';
import { PaymentService } from '../src/payment/payment.service';
import { BurnableBonusService } from '../src/credits/burnable-bonus.service';

async function testMetadata() {
    console.log('Testing Metadata extraction for PaymentService...');

    // Check design:paramtypes
    const paramTypes = Reflect.getMetadata('design:paramtypes', PaymentService);

    if (paramTypes) {
        console.log('✅ Found param types:', paramTypes.length);
        paramTypes.forEach((type: any, index: number) => {
            console.log(`Arg ${index}: ${type.name}`);
        });
    } else {
        console.log('❌ No param types found.');
    }
}

testMetadata();
