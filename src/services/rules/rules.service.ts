import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OverlayService } from '../fsm/overlay.service';
import { RuleTrigger, RuleActionType, RuleConditionOperator, OverlayType, User, RuleCondition, RuleAction } from '@prisma/client';

@Injectable()
export class RulesService {
    private readonly logger = new Logger(RulesService.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => OverlayService))
        private readonly overlayService: OverlayService,
    ) { }

    /**
     * Main Entry Point: Evaluate generic rules engine for a user and trigger
     */
    async process(userId: string, trigger: RuleTrigger, payload?: any) {
        // 1. Fetch Active Rules for this Trigger
        const rules = await this.prisma.rule.findMany({
            where: {
                isActive: true,
                trigger: trigger,
            },
            include: {
                conditions: true,
                actions: {
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: {
                priority: 'desc'
            }
        });

        if (rules.length === 0) return;

        this.logger.debug(`Evaluating ${rules.length} rules for trigger ${trigger} (User: ${userId})`);

        // 2. Fetch User & Build Context
        // We fetch relations needed for standard conditions
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                overlays: { where: { state: { in: ['ACTIVE', 'ELIGIBLE', 'EXPIRING'] } } },
                // We might need aggregates for some checks, but let's assume built metrics on User for now
                // or compute "on the fly" for complex checks.
            }
        });

        if (!user) {
            this.logger.warn(`User ${userId} not found for Rules Engine`);
            return;
        }

        const context = await this.buildContext(user, payload);

        // 3. Evaluate & Execute
        for (const rule of rules) {
            const isMatch = this.evaluateConditions(rule.conditions, context);
            if (isMatch) {
                this.logger.log(`✅ Rule Matched: ${rule.code} - ${rule.description}`);
                await this.executeActions(user, rule.actions, context);
            }
        }
    }

    private async buildContext(user: any, payload: any): Promise<any> {
        // Map user and overlay state to a flat context for conditions
        // e.g. "lifecycle" -> user.lifecycleState
        // "overlay.TRIPWIRE" -> exists?

        const overlaysMap: Record<string, any> = {};
        user.overlays.forEach((o: any) => {
            overlaysMap[o.type] = o;
        });

        return {
            user,
            lifecycle: user.lifecycleState,
            credits: user.credits,
            totalPayments: user.totalPayments,
            totalGenerations: user.totalGenerations,
            overlay: overlaysMap, // Access via overlay.TRIPWIRE
            payload: payload || {}, // Event specific payload
            bonusCredits: user.reservedCredits, // Example mapping
        };
    }

    private evaluateConditions(conditions: RuleCondition[], context: any): boolean {
        if (conditions.length === 0) return true;

        // Grouping Logic (AND inside group, OR between groups)
        const groups: Record<number, RuleCondition[]> = {};
        for (const c of conditions) {
            if (!groups[c.groupId]) groups[c.groupId] = [];
            groups[c.groupId].push(c);
        }

        for (const groupId in groups) {
            const groupConditions = groups[groupId];
            let groupMatch = true;

            for (const condition of groupConditions) {
                if (!this.checkCondition(condition, context)) {
                    groupMatch = false;
                    break;
                }
            }

            // If any group matches (OR behavior), return true
            if (groupMatch) return true;
        }

        return false;
    }

    private checkCondition(condition: RuleCondition, context: any): boolean {
        const { field, operator, value } = condition;
        const actualValue = this.resolveField(field, context);

        return this.compare(actualValue, operator, value);
    }

    private resolveField(path: string, context: any): any {
        // Support dot notation e.g. "overlay.TRIPWIRE"
        const parts = path.split('.');
        let current = context;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
    }

    private compare(actual: any, operator: RuleConditionOperator, expectedStr: string | null): boolean {
        // Handle "NOT_EXISTS" separately as actual might be undefined
        if (operator === RuleConditionOperator.NOT_EXISTS) {
            return actual === undefined || actual === null;
        }
        if (operator === RuleConditionOperator.EXISTS) {
            return actual !== undefined && actual !== null;
        }

        // Basic coercions
        let expected: any = expectedStr;
        if (expectedStr === 'true') expected = true;
        if (expectedStr === 'false') expected = false;
        if (!isNaN(Number(expectedStr)) && expectedStr !== '') expected = Number(expectedStr);

        const actualNum = Number(actual);

        switch (operator) {
            case RuleConditionOperator.EQUALS: return actual == expected;
            case RuleConditionOperator.NOT_EQUALS: return actual != expected;
            case RuleConditionOperator.GT: return actualNum > expected;
            case RuleConditionOperator.GTE: return actualNum >= expected;
            case RuleConditionOperator.LT: return actualNum < expected;
            case RuleConditionOperator.LTE: return actualNum <= expected;
            case RuleConditionOperator.IN:
                return typeof expectedStr === 'string' && expectedStr.split(',').includes(String(actual));
            case RuleConditionOperator.NOT_IN:
                return typeof expectedStr === 'string' && !expectedStr.split(',').includes(String(actual));
            default: return false;
        }
    }

    private async executeActions(user: User, actions: RuleAction[], context: any) {
        for (const action of actions) {
            const params = action.params as any || {};

            try {
                switch (action.type) {
                    case RuleActionType.ACTIVATE_OVERLAY:
                        // e.g. type: 'TRIPWIRE', ttlHours: 24
                        // We need to map params to OverlayService calls
                        if (params.type === OverlayType.TRIPWIRE) {
                            await this.overlayService.activateTripwire(user);
                        } else if (params.type === OverlayType.REFERRAL) {
                            await this.overlayService.enableReferral(user);
                        } else if (params.type === OverlayType.SPECIAL_OFFER) {
                            await this.overlayService.activateSpecialOffer(user, params.offerId);
                        }
                        // Generic activation? OverlayService needed refactoring to support generic, 
                        // but for now we map to existing methods or add new one.
                        break;

                    case RuleActionType.DEACTIVATE_OVERLAY:
                        // Implementation needed in OverlayService `deactivate(userId, type)`
                        // For now we might just log or implement a generic method
                        this.logger.warn(`Action DEACTIVATE_OVERLAY not fully implemented for ${params.type}`);
                        break;

                    case RuleActionType.GRANT_BONUS:
                        await this.overlayService.grantBonus(user, params.amount || 25, params.reason || 'rule_bonus', params.hours || 24);
                        break;

                    case RuleActionType.SEND_MESSAGE:
                    case RuleActionType.SEND_SPECIAL_OFFER:
                        // These are typically UI effects or Bot messages.
                        // OverlayService might handle them or we inject BotService.
                        // For separation, maybe OverlayService emits checks?
                        // Or we call BotService here.
                        this.logger.log(`[Action] Triggered ${action.type} for user ${user.id}`);
                        break;

                    case RuleActionType.NO_ACTION:
                        break;
                }
            } catch (e) {
                this.logger.error(`Failed to execute rule action ${action.id}: ${e.message}`);
            }
        }
    }
}
