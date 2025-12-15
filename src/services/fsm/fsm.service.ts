import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FSMEvent, FSMActionType, FSMConditionOperator, FSMContext, FSMEventPayload } from './fsm.types';
import { FSMState, FSMTransition, FSMCondition, User, UserFSMState, TransactionStatus, TransactionType, FSMEvent as PrismaFSMEvent } from '@prisma/client';
import { OverlayService } from './overlay.service';
import { BotService } from '../../grammy/bot.service';
import { RulesService } from '../rules/rules.service';
import { RuleTrigger } from '@prisma/client';

@Injectable()
export class FSMService {
    private readonly logger = new Logger(FSMService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly overlayService: OverlayService,
        @Inject(forwardRef(() => BotService))
        private readonly botService: BotService,
        @Inject(forwardRef(() => RulesService))
        private readonly rulesService: RulesService
    ) { }

    /**
     * Main entry point to trigger an FSM event for a user.
     */
    async trigger(userId: string, event: FSMEvent, payload?: FSMEventPayload) {
        this.logger.log(`Triggering FSM event: ${event} for user ${userId}`);

        // 1. Get User and Current State
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { fsmState: { include: { state: true } } },
        });

        if (!user) {
            this.logger.warn(`User ${userId} not found during FSM trigger`);
            return;
        }

        // Initialize state if missing (e.g. new system adoption)
        let currentState = user.fsmState?.state || null;
        let currentVersionId = user.fsmState?.versionId;

        if (!currentState) {
            const initResult = await this.initializeUserFSM(user);
            if (!initResult) return; // Initialization failed
            currentState = initResult.state;
            currentVersionId = initResult.versionId;
        }

        if (!currentState) {
            this.logger.error(`Could not determine FSM state for user ${userId}`);
            return;
        }

        // TERMINAL STATE CHECK
        if (currentState.isTerminal) {
            this.logger.debug(`User ${userId} is in terminal state ${currentState.name}. Skipping event ${event}`);
            return;
        }

        // 2. Find Applicable Transitions
        // We look for transitions FROM the current state that match the event
        // AND belong to the ACTIVE version (or user's version)
        // NOTE: Transitions are linked to version, so we filter by versionId if we want to be strict,
        // but typically the FSMState ID implies the version.
        // However, `FSMTransition` has `versionId` for safety.

        const transitions = await this.prisma.fSMTransition.findMany({
            where: {
                fromStateId: currentState.id,
                triggerEvent: event,
                // Optional: Ensure transition belongs to same version
                // versionId: currentVersionId
            },
            include: {
                conditions: true,
                actions: true,
                toState: true,
            },
            orderBy: {
                priority: 'desc', // Higher priority first
            },
        });

        // 3. Evaluate Conditions
        // We seek the FIRST transition where ALL conditions match (OR logic between transitions, AND logic within conditions)
        for (const transition of transitions) {
            const isMatch = await this.evaluateConditions(user, transition.conditions, payload);
            if (isMatch) {
                await this.executeTransition(user, transition, payload);
                return; // Stop after first successful transition (Idempotency handled by distinct events usually)
            }
        }

        // If no transition found, we might need to stay in same state or log "No transition"
        // If no transition found, we might need to stay in same state or log "No transition"
        this.logger.debug(`No valid transition found for ${event} from state ${currentState.name}`);

        // [NEW] Rules Engine Processing (Parallel to Lifecycle)
        // Even if no lifecycle transition happened, rules might trigger (e.g. Generation count incremented)
        const ruleTrigger = this.mapEventToRuleTrigger(event);
        if (ruleTrigger) {
            await this.rulesService.process(userId, ruleTrigger, payload);
        }
    }

    /**
     * Initializes a user into the default "NEW" state of the ACTIVE version.
     */
    private async initializeUserFSM(user: User): Promise<{ state: FSMState; versionId: number } | null> {
        // 1. Find Active Version
        const activeVersion = await this.prisma.fSMVersion.findFirst({
            where: { isActive: true },
        });

        if (!activeVersion) {
            this.logger.error(`No Active FSM Version found! Cannot initialize user ${user.id}`);
            return null;
        }

        // 2. Find Initial State for Active Version
        const initialState = await this.prisma.fSMState.findFirst({
            where: {
                versionId: activeVersion.id,
                isInitial: true
            },
        });

        if (!initialState) {
            this.logger.warn(`No initial FSM state found for version ${activeVersion.name}`);
            return null;
        }

        // Create UserFSMState
        await this.prisma.userFSMState.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                stateId: initialState.id,
                versionId: activeVersion.id, // Track version
                enteredAt: new Date(),
            },
            update: {
                stateId: initialState.id,
                versionId: activeVersion.id,
                enteredAt: new Date(),
            }
        });

        return { state: initialState, versionId: activeVersion.id };
    }

    /**
     * Evaluates a list of conditions against the user context.
     * ALL conditions must be true (AND logic).
     */
    async evaluateConditions(user: User, conditions: FSMCondition[], payload?: FSMEventPayload): Promise<boolean> {
        if (conditions.length === 0) return true;

        // Build Context
        const context = await this.buildContext(user, payload);

        // Grouping Logic: AND within groups, OR between groups?
        // Implementation Plan said: "AND within same groupId, OR between different groups"

        // 1. Group conditions
        const groups: Record<number, FSMCondition[]> = {};
        for (const c of conditions) {
            if (!groups[c.groupId]) groups[c.groupId] = [];
            groups[c.groupId].push(c);
        }

        // 2. Evaluate Groups (OR logic between groups)
        // If ANY group evaluates to TRUE, then the whole check is TRUE.
        for (const groupIdStr in groups) {
            const groupConditions = groups[groupIdStr];
            let groupResult = true;

            // Evaluate conditions in group (AND logic)
            for (const condition of groupConditions) {
                if (!this.checkCondition(condition, context)) {
                    groupResult = false;
                    break;
                }
            }

            if (groupResult === true) {
                return true; // Short-circuit OR
            }
        }

        return false; // No group satisfied
    }

    private async buildContext(user: User, payload?: FSMEventPayload): Promise<FSMContext> {
        // Fetch Aggregates
        // 1. Payments
        const payments = await this.prisma.transaction.aggregate({
            where: { userId: user.id, status: TransactionStatus.COMPLETED, type: TransactionType.PURCHASE },
            _count: true,
            _max: { createdAt: true }
        });

        // 2. Failed Payments (Latest)
        const lastFailedPayment = await this.prisma.transaction.findFirst({
            where: { userId: user.id, type: TransactionType.PURCHASE, status: TransactionStatus.FAILED },
            orderBy: { createdAt: 'desc' }
        });

        // 3. Last Generation
        const lastGen = await this.prisma.generation.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        });

        // 4. Calculate Virtual Fields
        const totalPayments = payments._count;
        const lastPaymentAt = payments._max.createdAt || undefined;
        // Check if last payment attempt was a failure (and newer than success)
        const lastPaymentFailed = !!lastFailedPayment &&
            (!lastPaymentAt || lastFailedPayment.createdAt > lastPaymentAt);

        const now = Date.now();
        const daysSinceCreated = (now - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const hoursSinceLastPay = lastPaymentAt ? (now - lastPaymentAt.getTime()) / (1000 * 60 * 60) : undefined;
        const hoursSinceLastGen = lastGen ? (now - lastGen.createdAt.getTime()) / (1000 * 60 * 60) : undefined;
        const hoursSinceLastActivity = (now - user.lastActiveAt.getTime()) / (1000 * 60 * 60);

        // Low Balance Logic (Hardcoded '10' or dynamic based on preferred model)
        // Assume basic gen cost is ~15 credits for now? Or 1? Let's say 20.
        const CREDITS_NEEDED = 20;
        const isLowBalance = user.credits < CREDITS_NEEDED;

        return {
            userId: user.id,
            userTags: user.tags || [],
            credits: user.credits,
            totalGenerations: user.totalGenerated,
            totalPayments,
            lastGenerationAt: lastGen?.createdAt || undefined,
            lastPaymentAt,
            lastPaymentFailed,
            createdAt: user.createdAt,
            preferredModel: lastGen?.modelId, // Simple heuristic

            // Virtual
            isPaidUser: totalPayments > 0,
            isLowBalance,
            daysSinceCreated,
            hoursSinceLastPay,
            hoursSinceLastGen,
            hoursSinceLastActivity,
        };
    }

    private checkCondition(condition: FSMCondition, context: FSMContext): boolean {
        const { field, operator, value } = condition;
        const currentValue = this.resolveFieldValue(field, context);
        return this.compareValues(currentValue, operator as FSMConditionOperator, value);
    }

    private resolveFieldValue(field: string, context: FSMContext): any {
        switch (field) {
            // Direct
            case 'credits_balance': return context.credits;
            case 'total_generations': return context.totalGenerations;
            case 'total_payments': return context.totalPayments;
            case 'is_paid_user': return context.isPaidUser;
            case 'user_tags': return context.userTags;
            case 'preferred_model': return context.preferredModel;
            case 'last_payment_failed': return context.lastPaymentFailed;

            // Computed Times
            case 'days_since_created': return context.daysSinceCreated;
            case 'hours_since_last_pay': return context.hoursSinceLastPay;
            case 'hours_since_last_gen': return context.hoursSinceLastGen;
            case 'hours_since_last_activity': return context.hoursSinceLastActivity;

            // Complex Logic
            case 'is_low_balance': return context.isLowBalance;
            case 'is_freeloader':
                return (context.totalGenerations > 0 && context.totalPayments === 0 && context.isLowBalance);
            case 'is_dead':
                return (context.totalGenerations === 0);

            default: return null;
        }
    }

    private compareValues(current: any, operator: FSMConditionOperator, target: string): boolean {
        // Basic type coercion logic
        let targetVal: any = target;
        if (!isNaN(Number(target))) targetVal = Number(target);
        if (target === 'true') targetVal = true;
        if (target === 'false') targetVal = false;

        // Ensure we are comparing compatible types for numeric variations
        const numCurrent = Number(current);
        const numTarget = Number(targetVal);
        const isNumeric = !isNaN(numCurrent) && !isNaN(numTarget) && typeof current !== 'boolean';

        switch (operator) {
            case FSMConditionOperator.EQUALS: return current == targetVal;
            case FSMConditionOperator.NOT_EQUALS: return current != targetVal;
            case FSMConditionOperator.GREATER_THAN: return isNumeric ? numCurrent > numTarget : false;
            case FSMConditionOperator.LESS_THAN: return isNumeric ? numCurrent < numTarget : false;
            case FSMConditionOperator.GREATER_OR_EQUAL: return isNumeric ? numCurrent >= numTarget : false;
            case FSMConditionOperator.LESS_OR_EQUAL: return isNumeric ? numCurrent <= numTarget : false;
            case FSMConditionOperator.CONTAINS:
                if (Array.isArray(current)) return current.includes(targetVal);
                if (typeof current === 'string') return current.includes(String(targetVal));
                return false;
            default: return false;
        }
    }

    private async executeTransition(user: User, transition: any, payload?: FSMEventPayload) {
        this.logger.log(`Executing transition ${transition.id} for user ${user.id} -> ${transition.toState.name}`);

        // Transactional Update
        await this.prisma.$transaction(async (tx) => {
            // 1. Update User State
            await tx.userFSMState.update({
                where: { userId: user.id },
                data: {
                    stateId: transition.toStateId,
                    versionId: transition.versionId, // Update version if transition moves versions? Usually same.
                    enteredAt: new Date(),
                    lastCheckedAt: new Date(), // Reset check timer
                }
            });

            // 2. Log History
            await tx.userFSMHistory.create({
                data: {
                    userId: user.id,
                    fromStateId: transition.fromStateId,
                    toStateId: transition.toStateId,
                    triggerEvent: transition.triggerEvent,
                    transitionId: transition.id,
                    actionsTaken: transition.actions ?? [],
                }
            });
        });

        // 3. Execute Actions (Post-State Update)
        // We execute actions after the state change is committed to ensure we don't block DB
        for (const action of transition.actions) {
            await this.dispatchAction(user, action, payload);
        }

        // [NEW] Rules Engine Processing (After Transition)
        // Context has changed (state updated), so we re-evaluate rules
        if (transition.triggerEvent) {
            const ruleTrigger = this.mapEventToRuleTrigger(transition.triggerEvent);
            if (ruleTrigger) {
                await this.rulesService.process(user.id, ruleTrigger, payload);
            }
        }
    }

    private async dispatchAction(user: User, action: any, payload?: FSMEventPayload) {
        this.logger.log(`Dispatching Action: ${action.type} for User ${user.id}`);

        try {
            const config = action.config as any || {};

            switch (action.type) {
                case FSMActionType.SEND_MESSAGE:
                    if (user.telegramId) {
                        await this.botService.sendMessage(Number(user.telegramId), config.templateId || config.message || 'Hello!');
                        this.logger.log(`[ACTION] Sent Message: ${config.templateId}`);
                    }
                    break;

                case FSMActionType.GRANT_BURNABLE_BONUS:
                    await this.overlayService.grantBonus(user, config.amount, 'fsm_action', config.hours);
                    this.logger.log(`[ACTION] Grant Bonus: ${config.amount}`);
                    break;

                case FSMActionType.TAG_USER:
                    // Add tag to user.tags if unique
                    const newTag = config.tag;
                    if (newTag && !user.tags.includes(newTag)) {
                        await this.prisma.user.update({
                            where: { id: user.id },
                            data: { tags: { push: newTag } }
                        });
                        this.logger.log(`[ACTION] Tagged User: ${newTag}`);
                    }
                    break;

                case FSMActionType.SHOW_TRIPWIRE:
                    await this.overlayService.activateTripwire(user);
                    this.logger.log(`[ACTION] Show Tripwire (Forced)`);
                    break;

                case FSMActionType.SEND_SPECIAL_OFFER:
                    await this.overlayService.activateSpecialOffer(user, config.offerId || 'default_offer');
                    this.logger.log(`[ACTION] Send Special Offer`);
                    break;

                case FSMActionType.ENABLE_REFERRAL:
                    await this.overlayService.enableReferral(user);
                    this.logger.log(`[ACTION] Enable Referral (Forced)`);
                    break;

                case FSMActionType.SWITCH_MODEL_HINT:
                    this.logger.log(`[ACTION] Switch Model Hint (Not implemented yet - requires user preferences service)`);
                    break;

                case FSMActionType.NO_ACTION:
                    // Explicit no-op
                    break;

                default:
                    this.logger.warn(`Unknown action type: ${action.type}`);
            }
        } catch (error) {
            this.logger.error(`Failed to execute action ${action.id}: ${error.message}`);
        }
    }

    // ==========================================
    // INSPECTION & MANUAL CONTROLS
    // ==========================================

    async getUserContext(userId: string): Promise<FSMContext> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                generations: { orderBy: { createdAt: 'desc' }, take: 1 },
                transactions: { orderBy: { createdAt: 'desc' }, take: 1 }
            }
        });
        if (!user) return null;
        return this.buildContext(user);
    }

    /**
     * Immersion: Replays user history against the FSM to find the correct state.
     * SKIPS all actions.
     */
    async immerseUser(userId: string, versionId: number) {
        this.logger.log(`Starting Immersion for user ${userId} on version ${versionId}`);

        // 1. Get User
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { fsmState: { include: { state: true } } },
        });
        if (!user) return;

        // 2. Build Context (History)
        const context = await this.buildContext(user);

        // 3. Start at Initial State of Target Version
        const initialState = await this.prisma.fSMState.findFirst({
            where: { versionId, isInitial: true }
        });

        if (!initialState) {
            this.logger.error(`No initial state for version ${versionId}`);
            return;
        }

        let currentState = initialState;
        let transitionsCount = 0;
        const MAX_DEPTH = 50; // Prevention for infinite loops

        // Loop until stable
        while (transitionsCount < MAX_DEPTH) {
            // Find all transitions from current state
            const transitions = await this.prisma.fSMTransition.findMany({
                where: { fromStateId: currentState.id, versionId },
                include: { conditions: true, toState: true },
                orderBy: { priority: 'desc' }
            });

            let transitionFound = null;

            for (const transition of transitions) {
                // Check if transition condition is met by HISTORY context
                // Note: We ignore Trigger Event types here and focus purely on Conditions + Context state
                // This assumes that if the condition is met (e.g. totalPayments > 0), the event happened.

                let isEventImplied = true;
                if (transition.triggerEvent === FSMEvent.PAYMENT_COMPLETED) {
                    isEventImplied = context.totalPayments > 0;
                } else if (transition.triggerEvent === FSMEvent.FIRST_GENERATION) {
                    isEventImplied = context.totalGenerations > 0;
                }

                if (!isEventImplied) continue;

                const isConditionMatch = await this.evaluateConditions(user, transition.conditions); // verify conditions

                if (isConditionMatch) {
                    transitionFound = transition;
                    break;
                }
            }

            if (transitionFound) {
                // Move to next state (Virtual Move)
                currentState = transitionFound.toState;
                transitionsCount++;
                if (currentState.isTerminal) break;
            } else {
                // Stable state reached
                break;
            }
        }

        // 4. Update User State in DB (Without Actions)
        await this.prisma.userFSMState.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                stateId: currentState.id,
                versionId,
                enteredAt: new Date(),
            },
            update: {
                stateId: currentState.id,
                versionId,
                enteredAt: new Date(),
            }
        });

        this.logger.log(`Immersion complete for user ${userId}. Final State: ${currentState.name}`);
    }

    /**
     * Manual Trigger: Checks transitions for the current state and forces execution if valid.
     * EXECUTES actions.
     */
    async evaluateUserStrict(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { fsmState: { include: { state: true } } },
        });

        if (!user || !user.fsmState) return;

        const currentState = user.fsmState.state;
        const versionId = user.fsmState.versionId;

        const transitions = await this.prisma.fSMTransition.findMany({
            where: { fromStateId: currentState.id, versionId },
            include: { conditions: true, actions: true, toState: true },
            orderBy: { priority: 'desc' }
        });

        for (const transition of transitions) {
            const isMatch = await this.evaluateConditions(user, transition.conditions);
            if (isMatch) {
                await this.executeTransition(user, transition);
                return;
            }
        }
    }

    async processState(stateId: string) {
        const users = await this.prisma.userFSMState.findMany({
            where: { stateId },
            select: { userId: true }
        });

        for (const u of users) {
            await this.evaluateUserStrict(u.userId);
        }
    }

    private mapEventToRuleTrigger(event: any): RuleTrigger | null {
        // Safe mapping using string comparison if Enums allow, otherwise explicit
        const e = event.toString();
        switch (e) {
            case 'BOT_START': return RuleTrigger.BOT_START;
            case 'GENERATION_COMPLETED': return RuleTrigger.GENERATION_COMPLETED;
            case 'CREDITS_CHANGED': return RuleTrigger.CREDITS_CHANGED;
            case 'PAYMENT_COMPLETED': return RuleTrigger.PAYMENT_COMPLETED;
            case 'PAYMENT_FAILED': return RuleTrigger.PAYMENT_FAILED;
            case 'TIMEOUT': return RuleTrigger.TIME; // Map timeout to time?
            case 'REFERRAL_INVITE': return RuleTrigger.REFERRAL_INVITE;
            case 'REFERRAL_PAID': return RuleTrigger.REFERRAL_PAID;
            case 'TRIPWIRE_SHOWN': return RuleTrigger.OVERLAY_ACTIVATED; // Kind of?
            case 'GENERATION_PENDING': return RuleTrigger.GENERATION_REQUESTED;
            default: return null;
        }
    }
}
