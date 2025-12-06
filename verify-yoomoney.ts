import { YooMoneyClient } from './libs/yoomoney-client/src/yoomoney-client.service';
import { ConfigService } from '@nestjs/config';

// Mock ConfigService
const mockConfigService = {
    get: (key: string) => {
        if (key === 'YOOMONEY_TOKEN') return 'test-token';
        if (key === 'YOOMONEY_WALLET') return '41001000000000';
        if (key === 'YOOMONEY_SUCCESS_URL') return 'https://example.com/success';
        if (key === 'DOMAIN') return 'https://example.com';
        return undefined;
    }
} as any;

const client = new YooMoneyClient(mockConfigService);

try {
    const form = client.generatePaymentForm(300, 'test-transaction-id', 'Test Payment');
    console.log('Generated Form:\n', form);
} catch (error) {
    console.error('Error:', error);
}
