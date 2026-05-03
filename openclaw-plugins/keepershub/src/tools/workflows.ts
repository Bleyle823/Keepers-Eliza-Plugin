import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, compact, fencedJson, runMcp } from './_shared.js';

const ListWorkflowsParams = Type.Object({
  projectId: Type.Optional(
    Type.String({ description: 'Optional KeeperHub project id to scope the listing.' }),
  ),
  tagId: Type.Optional(
    Type.String({ description: 'Optional KeeperHub tag id to filter by.' }),
  ),
});

const GetWorkflowParams = Type.Object({
  workflowId: Type.String({ description: 'KeeperHub workflow id (cuid/uuid).' }),
});

const NodeOrEdge = Type.Record(Type.String(), Type.Unknown());

const CreateWorkflowParams = Type.Object({
  name: Type.String({ description: 'Display name for the new workflow.' }),
  description: Type.Optional(Type.String()),
  nodes: Type.Optional(Type.Array(NodeOrEdge, { default: [] })),
  edges: Type.Optional(Type.Array(NodeOrEdge, { default: [] })),
  enabled: Type.Optional(Type.Boolean()),
});

const UpdateWorkflowParams = Type.Object({
  workflowId: Type.String(),
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  nodes: Type.Optional(Type.Array(NodeOrEdge)),
  edges: Type.Optional(Type.Array(NodeOrEdge)),
  enabled: Type.Optional(Type.Boolean()),
});

const DeleteWorkflowParams = Type.Object({
  workflowId: Type.String(),
});

const ExecuteWorkflowParams = Type.Object({
  workflowId: Type.String(),
  input: Type.Optional(
    Type.Record(Type.String(), Type.Unknown(), {
      description: 'Optional inputs to pass to the workflow trigger.',
    }),
  ),
});

const SearchOrgWorkflowsParams = Type.Object({
  query: Type.Optional(
    Type.String({ description: 'Substring to filter workflows by name or description.' }),
  ),
});

export function registerWorkflowTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_list_workflows',
    description:
      'List all KeeperHub workflows in the organization. Optionally filter by projectId or tagId.',
    parameters: ListWorkflowsParams,
    async execute(_id, params: Static<typeof ListWorkflowsParams>) {
      return runMcp(api, 'list_workflows', compact(params), (result) => {
        const list = Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
        if (list.length === 0) return 'No workflows found in your KeeperHub organization.';
        const lines = list.map(
          (w, i) =>
            `${i + 1}. **${(w.name as string | undefined) ?? 'Untitled'}** (ID: \`${w.id}\`) — ${
              w.enabled ? 'enabled' : 'disabled'
            }`,
        );
        return `Found ${list.length} workflow(s):\n\n${lines.join('\n')}`;
      });
    },
  });

  api.registerTool({
    name: 'kh_get_workflow',
    description:
      'Get full details of a KeeperHub workflow by ID, including nodes, edges, and configuration.',
    parameters: GetWorkflowParams,
    async execute(_id, params: Static<typeof GetWorkflowParams>) {
      return runMcp(api, 'get_workflow', { workflowId: params.workflowId }, (result) => {
        const w = asRecord(result);
        const nodes = Array.isArray(w.nodes) ? w.nodes.length : 0;
        return [
          `**Workflow: ${(w.name as string | undefined) ?? 'Untitled'}**`,
          `ID: \`${w.id}\``,
          `Enabled: ${w.enabled}`,
          `Nodes: ${nodes}`,
          '',
          fencedJson(result),
        ].join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_create_workflow',
    description:
      'Create a new KeeperHub workflow. Provide a name, optional description, and optional nodes/edges arrays describing the workflow graph.',
    parameters: CreateWorkflowParams,
    async execute(_id, params: Static<typeof CreateWorkflowParams>) {
      const args = compact({
        name: params.name,
        description: params.description,
        nodes: params.nodes ?? [],
        edges: params.edges ?? [],
        enabled: params.enabled,
      });
      return runMcp(api, 'create_workflow', args, (result) => {
        const w = asRecord(result);
        return [
          'Workflow created successfully!',
          '',
          `**Name:** ${w.name}`,
          `**ID:** \`${w.id}\``,
          `**Enabled:** ${w.enabled}`,
        ].join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_update_workflow',
    description:
      "Update an existing KeeperHub workflow's name, description, nodes, edges, or enabled flag.",
    parameters: UpdateWorkflowParams,
    async execute(_id, params: Static<typeof UpdateWorkflowParams>) {
      const args = compact(params);
      return runMcp(api, 'update_workflow', args, (result) => {
        const w = asRecord(result);
        return `Workflow updated successfully!\n\n**Name:** ${w.name}\n**ID:** \`${w.id}\``;
      });
    },
  });

  api.registerTool({
    name: 'kh_delete_workflow',
    description: 'Permanently delete a KeeperHub workflow. This action is irreversible.',
    parameters: DeleteWorkflowParams,
    async execute(_id, params: Static<typeof DeleteWorkflowParams>) {
      return runMcp(
        api,
        'delete_workflow',
        { workflowId: params.workflowId },
        () => `Workflow \`${params.workflowId}\` has been permanently deleted.`,
      );
    },
  });

  api.registerTool({
    name: 'kh_execute_workflow',
    description:
      'Manually trigger a KeeperHub workflow execution. Returns an execution ID that can be polled with kh_get_execution_status.',
    parameters: ExecuteWorkflowParams,
    async execute(_id, params: Static<typeof ExecuteWorkflowParams>) {
      const args: Record<string, unknown> = { workflowId: params.workflowId };
      if (params.input && typeof params.input === 'object') args.input = params.input;
      return runMcp(api, 'execute_workflow', args, (result) => {
        const r = asRecord(result);
        const execId = (r.executionId ?? r.id ?? 'unknown') as string;
        return [
          'Workflow execution started!',
          '',
          `**Execution ID:** \`${execId}\``,
          '',
          `Use kh_get_execution_status with executionId="${execId}" to check progress.`,
        ].join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_search_org_workflows',
    description:
      "Search workflows in the caller's KeeperHub organization by name or description substring.",
    parameters: SearchOrgWorkflowsParams,
    async execute(_id, params: Static<typeof SearchOrgWorkflowsParams>) {
      return runMcp(api, 'list_workflows', {}, (result) => {
        const all = Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
        const query = (params.query ?? '').trim().toLowerCase();
        const filtered = query
          ? all.filter((w) => {
              const name = ((w.name as string | undefined) ?? '').toLowerCase();
              const description = ((w.description as string | undefined) ?? '').toLowerCase();
              return name.includes(query) || description.includes(query);
            })
          : all;

        if (filtered.length === 0) {
          return query
            ? `No workflows found matching "${params.query}".`
            : 'No workflows found in your KeeperHub organization.';
        }

        const lines = filtered.map(
          (w, i) =>
            `${i + 1}. **${(w.name as string | undefined) ?? 'Untitled'}** (ID: \`${w.id}\`) — ${
              (w.description as string | undefined) ?? 'no description'
            }`,
        );
        const header = query
          ? `Found ${filtered.length} workflow(s) matching "${params.query}":`
          : `Found ${filtered.length} workflow(s):`;
        return `${header}\n\n${lines.join('\n')}`;
      });
    },
  });
}
