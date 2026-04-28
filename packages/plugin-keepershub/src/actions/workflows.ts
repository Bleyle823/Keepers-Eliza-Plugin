import type { Action, IAgentRuntime } from '@elizaos/core';
import {
  extractId,
  extractJson,
  handleToolCall,
  validateKeeperHub,
  validationError,
} from './_helpers.ts';

const WORKFLOW_KEYWORDS = ['workflowId', 'workflow', 'id'];

export const listWorkflowsAction: Action = {
  name: 'LIST_WORKFLOWS',
  similes: ['list_workflows', 'SHOW_WORKFLOWS', 'GET_WORKFLOWS', 'WORKFLOWS_LIST'],
  description: 'List all KeeperHub workflows in the organization. Optionally filter by projectId or tagId.',

  validate: async (runtime: IAgentRuntime) => validateKeeperHub(runtime),

  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? '';
    const projectId = extractId(text, ['projectId', 'project']);
    const tagId = extractId(text, ['tagId', 'tag']);
    const args: Record<string, unknown> = {};
    if (projectId) args.projectId = projectId;
    if (tagId) args.tagId = tagId;

    return handleToolCall('list_workflows', args, runtime, message, callback, (result) => {
      const list = Array.isArray(result) ? result : [];
      if (list.length === 0) return 'No workflows found in your KeeperHub organization.';
      const lines = list.map((w: Record<string, unknown>, i) =>
        `${i + 1}. **${w.name ?? 'Untitled'}** (ID: \`${w.id}\`) — ${w.enabled ? 'enabled' : 'disabled'}`
      );
      return `Found ${list.length} workflow(s):\n\n${lines.join('\n')}`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'List all my KeeperHub workflows' } },
      { name: '{{agent}}', content: { text: 'Found 2 workflow(s):\n\n1. **Aave Guardian** (ID: `abc123`) — enabled', actions: ['LIST_WORKFLOWS'] } },
    ],
  ],
};

export const getWorkflowAction: Action = {
  name: 'GET_WORKFLOW',
  similes: ['get_workflow', 'FETCH_WORKFLOW', 'SHOW_WORKFLOW', 'WORKFLOW_DETAILS'],
  description: 'Get full details of a KeeperHub workflow by ID, including nodes, edges, and configuration.',

  validate: async (runtime) => validateKeeperHub(runtime),

  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);
    const workflowId = ((parsed.workflowId as string) ?? extractId(text, WORKFLOW_KEYWORDS))?.trim();

    if (!workflowId) {
      return validationError(
        'Please provide a workflow ID. Example: "Get workflow `clr1k2j3a0001x9pq7e2v3w4f`" or `{"workflowId":"..."}`.',
        'Missing workflowId',
        callback,
        message,
        { field: 'workflowId' }
      );
    }

    return handleToolCall('get_workflow', { workflowId }, runtime, message, callback, (result) => {
      const w = result as Record<string, unknown>;
      return `**Workflow: ${w.name ?? 'Untitled'}**\nID: \`${w.id}\`\nEnabled: ${w.enabled}\nNodes: ${(w.nodes as unknown[])?.length ?? 0}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Get workflow abc123' } },
      { name: '{{agent}}', content: { text: '**Workflow: My Workflow**\nID: `abc123`', actions: ['GET_WORKFLOW'] } },
    ],
  ],
};

export const createWorkflowAction: Action = {
  name: 'CREATE_WORKFLOW',
  similes: ['create_workflow', 'NEW_WORKFLOW', 'BUILD_WORKFLOW', 'MAKE_WORKFLOW'],
  description: 'Create a new KeeperHub workflow. Provide the workflow definition as JSON in your message.',

  validate: async (runtime) => validateKeeperHub(runtime),

  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);

    const name = (parsed.name as string) ?? text.match(/(?:called|named)\s+"([^"]+)"/i)?.[1] ?? 'New Workflow';
    const nodes = (parsed.nodes as unknown[]) ?? [];
    const edges = (parsed.edges as unknown[]) ?? [];
    const description = (parsed.description as string) ?? '';

    const args: Record<string, unknown> = { name, nodes, edges };
    if (description) args.description = description;

    return handleToolCall('create_workflow', args, runtime, message, callback, (result) => {
      const w = result as Record<string, unknown>;
      return `Workflow created successfully!\n\n**Name:** ${w.name}\n**ID:** \`${w.id}\`\n**Enabled:** ${w.enabled}`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Create a workflow called "My Monitor" with a manual trigger' } },
      { name: '{{agent}}', content: { text: 'Workflow created successfully!\n\n**Name:** My Monitor\n**ID:** `xyz789`', actions: ['CREATE_WORKFLOW'] } },
    ],
  ],
};

export const updateWorkflowAction: Action = {
  name: 'UPDATE_WORKFLOW',
  similes: ['update_workflow', 'EDIT_WORKFLOW', 'MODIFY_WORKFLOW', 'PATCH_WORKFLOW'],
  description: 'Update an existing KeeperHub workflow\'s name, description, nodes, or edges.',

  validate: async (runtime) => validateKeeperHub(runtime),

  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);
    const workflowId = ((parsed.workflowId as string) ?? extractId(text, WORKFLOW_KEYWORDS))?.trim();

    if (!workflowId) {
      return validationError(
        'Please provide a workflowId to update. Example: `update workflow workflowId: clr1k2j3a0001x9pq7e2v3w4f` or include `"workflowId"` in JSON.',
        'Missing workflowId',
        callback,
        message,
        { field: 'workflowId' }
      );
    }

    const args: Record<string, unknown> = { workflowId };
    if (parsed.name) args.name = parsed.name;
    if (parsed.description) args.description = parsed.description;
    if (parsed.nodes) args.nodes = parsed.nodes;
    if (parsed.edges) args.edges = parsed.edges;

    return handleToolCall('update_workflow', args, runtime, message, callback, (result) => {
      const w = result as Record<string, unknown>;
      return `Workflow updated successfully!\n\n**Name:** ${w.name}\n**ID:** \`${w.id}\``;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Update workflow abc123 name to "New Name"' } },
      { name: '{{agent}}', content: { text: 'Workflow updated successfully!\n\n**Name:** New Name\n**ID:** `abc123`', actions: ['UPDATE_WORKFLOW'] } },
    ],
  ],
};

export const deleteWorkflowAction: Action = {
  name: 'DELETE_WORKFLOW',
  similes: ['delete_workflow', 'REMOVE_WORKFLOW', 'DESTROY_WORKFLOW'],
  description: 'Permanently delete a KeeperHub workflow. This action is irreversible.',

  validate: async (runtime) => validateKeeperHub(runtime),

  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);
    const workflowId = ((parsed.workflowId as string) ?? extractId(text, WORKFLOW_KEYWORDS))?.trim();

    if (!workflowId) {
      return validationError(
        'Please provide a workflow ID to delete. Example: `delete workflow workflowId: clr1k2j3a0001x9pq7e2v3w4f`.',
        'Missing workflowId',
        callback,
        message,
        { field: 'workflowId' }
      );
    }

    return handleToolCall('delete_workflow', { workflowId }, runtime, message, callback, () =>
      `Workflow \`${workflowId}\` has been permanently deleted.`
    );
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Delete workflow abc123' } },
      { name: '{{agent}}', content: { text: 'Workflow `abc123` has been permanently deleted.', actions: ['DELETE_WORKFLOW'] } },
    ],
  ],
};

export const executeWorkflowAction: Action = {
  name: 'EXECUTE_WORKFLOW',
  similes: ['execute_workflow', 'RUN_WORKFLOW', 'TRIGGER_WORKFLOW', 'START_WORKFLOW'],
  description:
    'Manually trigger a KeeperHub workflow execution. Returns an execution ID for status polling. Requires a workflowId — use LIST_WORKFLOWS or SEARCH_ORG_WORKFLOWS to discover ids.',

  validate: async (runtime) => validateKeeperHub(runtime),

  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? '';
    const parsed = extractJson(text);
    const workflowId = ((parsed.workflowId as string) ?? extractId(text, WORKFLOW_KEYWORDS))?.trim();

    if (!workflowId) {
      return validationError(
        [
          'Please provide a workflow ID to execute.',
          'Examples:',
          '  - `execute workflow workflowId: clr1k2j3a0001x9pq7e2v3w4f`',
          '  - `run workflow `clr1k2j3a0001x9pq7e2v3w4f``',
          '  - `{"workflowId":"clr1k2j3a0001x9pq7e2v3w4f","input":{...}}`',
          '',
          'Use **list workflows** to discover ids.',
        ].join('\n'),
        'Missing workflowId',
        callback,
        message,
        { field: 'workflowId' }
      );
    }

    const args: Record<string, unknown> = { workflowId };
    if (parsed.input && typeof parsed.input === 'object') args.input = parsed.input;

    return handleToolCall('execute_workflow', args, runtime, message, callback, (result) => {
      const r = result as Record<string, unknown>;
      const execId = r.executionId ?? r.id ?? 'unknown';
      return `Workflow execution started!\n\n**Execution ID:** \`${execId}\`\n\nUse "get execution status ${execId}" to check progress.`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Run workflow workflowId: clr1k2j3a0001x9pq7e2v3w4f' } },
      { name: '{{agent}}', content: { text: 'Workflow execution started!\n\n**Execution ID:** `exec456`', actions: ['EXECUTE_WORKFLOW'] } },
    ],
  ],
};

export const searchOrgWorkflowsAction: Action = {
  name: 'SEARCH_ORG_WORKFLOWS',
  similes: ['search_workflows', 'FIND_WORKFLOWS', 'SEARCH_MY_WORKFLOWS'],
  description: 'Search workflows in your KeeperHub organization by name or description.',

  validate: async (runtime) => validateKeeperHub(runtime),

  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text ?? '';
    const query = text.replace(/search|find|workflows?|my/gi, '').trim().toLowerCase();

    return handleToolCall('list_workflows', {}, runtime, message, callback, (result) => {
      const all = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
      const filtered = query
        ? all.filter((w) =>
            (w.name as string ?? '').toLowerCase().includes(query) ||
            (w.description as string ?? '').toLowerCase().includes(query)
          )
        : all;

      if (filtered.length === 0) return `No workflows found matching "${query}".`;
      const lines = filtered.map((w, i) =>
        `${i + 1}. **${w.name ?? 'Untitled'}** (ID: \`${w.id}\`) — ${w.description ?? 'no description'}`
      );
      return `Found ${filtered.length} workflow(s) matching "${query}":\n\n${lines.join('\n')}`;
    });
  },

  examples: [
    [
      { name: '{{user}}', content: { text: 'Search workflows aave' } },
      { name: '{{agent}}', content: { text: 'Found 1 workflow(s) matching "aave":\n\n1. **Aave Guardian**', actions: ['SEARCH_ORG_WORKFLOWS'] } },
    ],
  ],
};
