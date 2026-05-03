import { Type, type Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/plugin-entry';

import { asRecord, compact, runMcp } from './_shared.js';

const SearchTemplatesParams = Type.Object({
  query: Type.Optional(Type.String({ description: 'Free-text search query.' })),
  category: Type.Optional(Type.String({ description: 'Optional category filter.' })),
});

const TemplateIdParams = Type.Object({
  templateId: Type.String({ description: 'KeeperHub template id.' }),
});

const DeployTemplateParams = Type.Object({
  templateId: Type.String({ description: 'KeeperHub template id to clone.' }),
  name: Type.Optional(Type.String({ description: 'Display name for the deployed copy.' })),
});

export function registerTemplateTools(api: OpenClawPluginApi): void {
  api.registerTool({
    name: 'kh_search_templates',
    description:
      'Search for pre-built KeeperHub workflow templates that can be deployed and customized.',
    parameters: SearchTemplatesParams,
    async execute(_id, params: Static<typeof SearchTemplatesParams>) {
      return runMcp(api, 'search_templates', compact(params), (result) => {
        const list = Array.isArray(result)
          ? (result as Array<Record<string, unknown>>)
          : Array.isArray(asRecord(result).items)
          ? (asRecord(result).items as Array<Record<string, unknown>>)
          : [];

        if (list.length === 0) return 'No templates found matching your query.';
        const lines = list
          .slice(0, 10)
          .map(
            (t, i) =>
              `${i + 1}. **${(t.name as string | undefined) ?? 'Untitled'}** (ID: \`${t.id}\`) — ${
                (t.description as string | undefined) ?? ''
              }`,
          );
        return [
          `Found ${list.length} template(s):`,
          '',
          lines.join('\n'),
          '',
          'Use kh_get_template for full details, or kh_deploy_template to clone one.',
        ].join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_get_template',
    description: 'Get full details of a specific KeeperHub workflow template by ID.',
    parameters: TemplateIdParams,
    async execute(_id, params: Static<typeof TemplateIdParams>) {
      return runMcp(api, 'get_template', { templateId: params.templateId }, (result) => {
        const t = asRecord(result);
        const nodes = Array.isArray(t.nodes) ? t.nodes.length : 0;
        const lines = [
          `**Template: ${(t.name as string | undefined) ?? 'Untitled'}**`,
          `ID: \`${t.id}\``,
          t.description ? `Description: ${t.description}` : '',
          `Nodes: ${nodes}`,
          '',
          `Use kh_deploy_template with templateId="${t.id}" to clone this template into your org.`,
        ].filter(Boolean);
        return lines.join('\n');
      });
    },
  });

  api.registerTool({
    name: 'kh_deploy_template',
    description:
      'Clone a public KeeperHub template workflow into your organization as a new workflow. The new workflow is disabled by default; enable it with kh_update_workflow when ready.',
    parameters: DeployTemplateParams,
    async execute(_id, params: Static<typeof DeployTemplateParams>) {
      const args = compact({ templateId: params.templateId, name: params.name });
      return runMcp(api, 'deploy_template', args, (result) => {
        const w = asRecord(result);
        return [
          'Template deployed as a new workflow!',
          '',
          `**Name:** ${w.name}`,
          `**ID:** \`${w.id}\``,
          '',
          'The workflow is disabled by default. Use kh_update_workflow with `enabled: true` when ready.',
        ].join('\n');
      });
    },
  });
}
