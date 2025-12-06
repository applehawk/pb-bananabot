import { createHmac } from 'crypto';

export class CryptoHelper {
    static signParams(params: Record<string, string | number>, secret: string): string {
        // Sort keys to ensure consistent signature
        const sortedKeys = Object.keys(params).sort();
        const dataString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

        return createHmac('sha256', secret)
            .update(dataString)
            .digest('hex');
    }

    static verifyParams(params: Record<string, string | number>, signature: string, secret: string): boolean {
        const expectedSignature = this.signParams(params, secret);
        return expectedSignature === signature;
    }
}
