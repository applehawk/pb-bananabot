import { FSMEvent, FSMActionType } from '@prisma/client';

export { FSMEvent, FSMActionType };

// Re-export state codes if needed, or keep local if not in DB enum
export export enum FSMStateCode {
    // Lifecycle States
    NEW = 'NEW',
    ACTIVATING = 'ACTIVATING',
    ACTIVE_FREE = 'ACTIVE_FREE',
    PAYWALL = 'PAYWALL',
    PAID_ACTIVE = 'PAID_ACTIVE',
    INACTIVE = 'INACTIVE',
    CHURNED = 'CHURNED',
    BLOCKED = 'BLOCKED',
}

export enum OverlayType {
    TRIPWIRE = 'TRIPWIRE',
    BONUS = 'BONUS',
    REFERRAL = 'REFERRAL',
    SPECIAL_OFFER = 'SPECIAL_OFFER',
}

export interface OverlayState {
    type: OverlayType;
    state: 'ELIGIBLE' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED';
    expiresAt?: Date;
    metadata?: any;
}

export enum FSMConditionOperator {
    EQUALS = '=',
    NOT_EQUALS = '!=',
    GREATER_THAN = '>',
    LESS_THAN = '<',
    GREATER_OR_EQUAL = '>=',
    LESS_OR_EQUAL = '<=',
    EXISTS = 'EXISTS',
    NOT_EXISTS = 'NOT_EXISTS',
    CONTAINS = 'CONTAINS', // For arrays/strings
    IN = 'IN', // Value in [list]
}

export interface FSMContext {
    userId: string;
    userTags: string[];
    credits: number;
    totalGenerations: number;
    totalPayments: number;
    lastGenerationAt?: Date;
    lastPaymentAt?: Date;
    lastPaymentFailed: boolean;
    createdAt: Date;
    preferredModel?: string;
    // Virtual fields
    isPaidUser: boolean;
    isLowBalance: boolean; // credits < needed
    daysSinceCreated: number;
    hoursSinceLastPay?: number;
    hoursSinceLastGen?: number;
    hoursSinceLastActivity?: number;
}

// Payload passed when triggering an event
export interface FSMEventPayload {
    generationId?: string;
    modelId?: string;
    transactionId?: string;
    amount?: number;
    currency?: string;
    packageId?: string;
    credits?: number; // For PACKAGE_PURCHASE or general credit info
    creditsUsed?: number; // For GENERATION and INSUFFICIENT_CREDITS
    referralCode?: string; // For REFERRAL_INVITE
    reason?: string;
    error?: string;
}