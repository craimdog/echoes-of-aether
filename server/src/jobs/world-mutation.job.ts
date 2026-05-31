import type { WorldMutation } from '@aether/shared';

export interface WorldMutationJobData {
    mutation: WorldMutation;
    triggeredByCharId?: string;
}