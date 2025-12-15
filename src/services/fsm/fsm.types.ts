import { FSMEvent, FSMActionType } from '@prisma/client';

export { FSMEvent, FSMActionType };

// Re-export state codes if needed, or keep local if not in DB enum
export enum FSMStateCode {
    // Lifecycle States
    NEW = 'NEW', // [NEW]

    // [STARTED, DEAD, FIRST_GENERATION, EARLY_EXPERIMENTER]
    ACTIVATING = 'ACTIVATING',

    // [ACTIVE_FREE, LOW_BALANCE_FREE, FREELOADER_EXPERIMENTER]
    ACTIVE_FREE = 'ACTIVE_FREE',

    // [FREE_EXHAUSTED, PAID_EXHAUSTED, TRIPWIRE_ELIGIBLE, TRIPWIRE_OFFERED, TRIPWIRE_EXPIRED]
    PAYWALL = 'PAYWALL',

    // [PAID_ACTIVE, PAID_LOW_BALANCE]
    PAID_ACTIVE = 'PAID_ACTIVE', // Note: BONUS states are now Overlays

    // [INACTIVE_FREE, INACTIVE_PAID, CHURN_RISK]
    INACTIVE = 'INACTIVE',

    // [LONG_TERM_CHURN]
    CHURNED = 'CHURNED',

    // [BLOCKED, SUPPRESSED]
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
    // Offers
    packageId?: string;
    count?: number; // For PACKAGE_VIEW

    // Bonus
    streakDays?: number;
    credits?: number; // For PACKAGE_PURCHASE or general credit info
    creditsUsed?: number; // For GENERATION and INSUFFICIENT_CREDITS

    // Balance
    newBalance?: number;
    change?: number;

    referralCode?: string; // For REFERRAL_INVITE
    reason?: string;
    error?: string;
}