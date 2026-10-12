import Constants from 'expo-constants';
import { APPROVED_ORCHESTRATOR_BINDING } from './binding';

/** Build switch only; permission is always checked by the server with the current JWT. */
export function orchestratorPilotEnabled(): boolean {
  return Constants.expoConfig?.extra?.gptourOrchestratorPilotEnabled === true
    && APPROVED_ORCHESTRATOR_BINDING?.provenance === 'handoff-verified';
}