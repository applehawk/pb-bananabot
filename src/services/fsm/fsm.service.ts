import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FSMEvent, FSMActionType, FSMConditionOperator, FSMContext, FSMEventPayload } from './fsm.types';
import { FSMState, FSMTransition, FSMCondition, User, UserFSMState } from '@prisma/client';

@Injectable()
export class FSMService {
    private readonly logger = new Logger(FSMService.name);

    constructor(private readonly prisma: PrismaService) { }

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
        this.logger.debug(`No valid transition found for ${event} from state ${currentState.name}`);
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
        // Determine dynamic values like totalGenerations, etc.
        // In a real app, you might want to fetch aggregations here if fields are missing on User
        // But User model has `credits`, `totalGenerations`, etc.

        return {
            userId: user.id,
            userTags: user.tags || [],
            credits: user.credits,
            totalGenerations: user.totalGenerated,
            totalPayments: 0, // TODO: Add field to User or query count
            createdAt: user.createdAt,
            lastGenerationAt: undefined, // TODO
            // ... populate virtual fields
        };
    }

    private checkCondition(condition: FSMCondition, context: FSMContext): boolean {
        const { field, operator, value } = condition;

        // 1. Resolve Field Value
        const currentValue = this.resolveFieldValue(field, context);

        // 2. Compare
        return this.compareValues(currentValue, operator as FSMConditionOperator, value);
    }

    private resolveFieldValue(field: string, context: FSMContext): any {
        switch (field) {
            case 'credits_balance': return context.credits;
            case 'total_generations': return context.totalGenerations;
            case 'user_tags': return context.userTags;
            // ... Add all supported fields
            case 'now_minus_created_hours':
                return (Date.now() - context.createdAt.getTime()) / (1000 * 60 * 60);
            default: return null;
        }
    }

    private compareValues(current: any, operator: FSMConditionOperator, target: string): boolean {
        // Basic type coercion logic
        let targetVal: any = target;
        if (!isNaN(Number(target))) targetVal = Number(target);
        if (target === 'true') targetVal = true;
        if (target === 'false') targetVal = false;

        switch (operator) {
            case FSMConditionOperator.EQUALS: return current == targetVal;
            case FSMConditionOperator.NOT_EQUALS: return current != targetVal;
            case FSMConditionOperator.GREATER_THAN: return Number(current) > Number(targetVal);
            case FSMConditionOperator.LESS_THAN: return Number(current) < Number(targetVal);
            case FSMConditionOperator.GREATER_OR_EQUAL: return Number(current) >= Number(targetVal);
            case FSMConditionOperator.LESS_OR_EQUAL: return Number(current) <= Number(targetVal);
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
    }

    private async dispatchAction(user: User, action: any, payload?: FSMEventPayload) {
        this.logger.log(`Dispatching Action: ${action.type} for User ${user.id}`);

        try {
            const config = action.config as any || {};

            switch (action.type) {
                case FSMActionType.SEND_MESSAGE:
                    // await this.messagingService.sendMessage(user.telegramId, config.templateId, payload);
                    this.logger.log(`[ACTION] Send Message Template: ${config.templateId}`);
                    break;

                case FSMActionType.GRANT_BURNABLE_BONUS:
                    // await this.bonusService.grantBonus(user.id, config.amount, config.hours);
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
                    this.logger.log(`[ACTION] Show Tripwire`);
                    break;

                default:
                    this.logger.warn(`Unknown action type: ${action.type}`);
            }
        } catch (error) {
            this.logger.error(`Failed to execute action ${action.id}: ${error.message}`);
        }
    }
}
