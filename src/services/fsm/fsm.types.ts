import { FSMEvent, FSMActionType } from '@prisma/client';

export { FSMEvent, FSMActionType };

// Re-export state codes if needed, or keep local if not in DB enum
export enum FSMStateCode {
    // A. System
    NEW = 'NEW',
    STARTED = 'STARTED',

    // B. Activation
    DEAD = 'DEAD',
    FIRST_GENERATION = 'FIRST_GENERATION',
    EARLY_EXPERIMENTER = 'EARLY_EXPERIMENTER',

    // C. Free Usage
    ACTIVE_FREE = 'ACTIVE_FREE',
    LOW_BALANCE_FREE = 'LOW_BALANCE_FREE',
    FREE_EXHAUSTED = 'FREE_EXHAUSTED',
    FREELOADER_EXPERIMENTER = 'FREELoader_EXPERIMENTER',

    // D. Monetization
    TRIPWIRE_ELIGIBLE = 'TRIPWIRE_ELIGIBLE',
    TRIPWIRE_OFFERED = 'TRIPWIRE_OFFERED',
    TRIPWIRE_EXPIRED = 'TRIPWIRE_EXPIRED',

    PAYMENT_CLICKED = 'PAYMENT_CLICKED',
    PAYMENT_FAILED = 'PAYMENT_FAILED',

    PAID_ACTIVE = 'PAID_ACTIVE',
    PAID_LOW_BALANCE = 'PAID_LOW_BALANCE',
    PAID_EXHAUSTED = 'PAID_EXHAUSTED',

    // E. Offer / Bonus
    BURNABLE_BONUS_ACTIVE = 'BURNABLE_BONUS_ACTIVE',
    BURNABLE_BONUS_EXPIRING = 'BURNABLE_BONUS_EXPIRING',
    BURNABLE_BONUS_EXPIRED = 'BURNABLE_BONUS_EXPIRED',

    SPECIAL_OFFER_SHOWN = 'SPECIAL_OFFER_SHOWN',
    SPECIAL_OFFER_EXPIRED = 'SPECIAL_OFFER_EXPIRED',

    // F. Referral
    REFERRAL_ELIGIBLE = 'REFERRAL_ELIGIBLE',
    REFERRAL_ACTIVE = 'REFERRAL_ACTIVE',
    REFERRAL_REWARDED = 'REFERRAL_REWARDED',
    REFERRAL_PAID_REWARDED = 'REFERRAL_PAID_REWARDED',

    // G. Activity / Inactivity
    INACTIVE_FREE = 'INACTIVE_FREE',
    INACTIVE_PAID = 'INACTIVE_PAID',
    CHURN_RISK = 'CHURN_RISK',
    LONG_TERM_CHURN = 'LONG_TERM_CHURN',

    // H. Terminal
    BLOCKED = 'BLOCKED',
    SUPPRESSED = 'SUPPRESSED',
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
    createdAt: Date;
    // ... any other dynamic data needed for evaluation
}

// Payload passed when triggering an event
export interface FSMEventPayload {
    amount?: number; // for payment/credits
    generationId?: string;
    error?: string; // for failures
    modelId?: string;
    paymentMethod?: string;
}
