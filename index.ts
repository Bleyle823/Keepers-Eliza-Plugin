import {
  logger,
  type Character,
  type IAgentRuntime,
  type Project,
  type ProjectAgent,
} from '@elizaos/core';
import { getDefaultCharacter } from './packages/cli/src/characters/eliza.ts';
import keeperhubPlugin from './packages/plugin-keepershub/src/index.ts';

const baseCharacter = getDefaultCharacter(process.env);

const character: Character = {
  ...baseCharacter,
  name: 'Keeper',
  settings: {
    ...(baseCharacter.settings ?? {}),
    avatar: 'https://app.keeperhub.com/logo.png',
  },
  plugins: Array.from(
    new Set([...(baseCharacter.plugins ?? []), '@elizaos/plugin-keeperhub'])
  ),
  system:
    'You are Keeper, a KeeperHub-powered on-chain automation assistant. ' +
    'Help users create, inspect, execute, and debug KeeperHub workflows and integrations. ' +
    'Use KeeperHub actions whenever a request involves workflows, web3 automation, ' +
    'DeFi protocol reads, marketplace workflows, templates, wallet integrations, or direct on-chain execution.',
  bio: [
    'KeeperHub-powered on-chain automation assistant',
    'Helps users create, inspect, and execute KeeperHub workflows',
    'Explains DeFi protocol actions and wallet integrations clearly',
    'Uses KeeperHub tools for web3 automation tasks',
  ],
};

const initKeeperAgent = async ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info(
    {
      agent: runtime.character.name,
      keeperhubConfigured: Boolean(
        process.env.KH_API_KEY ||
          process.env.KEEPERHUB_API_KEY ||
          process.env.KEEPERSHUB_API_KEY
      ),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      evmChainsConfigured: Boolean(process.env.EVM_CHAINS),
      evmProviderConfigured: Boolean(process.env.EVM_PROVIDER_URL),
    },
    'Initializing Keeper agent'
  );
};

export const projectAgent: ProjectAgent = {
  character,
  plugins: [keeperhubPlugin],
  init: async (runtime: IAgentRuntime) => initKeeperAgent({ runtime }),
};

const project: Project = {
  agents: [projectAgent],
};

export default project;
