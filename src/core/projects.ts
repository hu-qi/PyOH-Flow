export type Board = 'generic' | 'esp32' | 'pico';
export interface Project {
  id: string;
  name: string;
  updatedAt: string;
  board: Board;
  workspace: Record<string, unknown>;
}

export const STORE_KEY = 'pyoh-flow:projects:v1';
export const SELECTED_KEY = 'pyoh-flow:selected:v1';

export const DEMO_WORKSPACE: Record<string, unknown> = {
  blocks: {
    languageVersion: 0,
    blocks: [{
      type: 'py_start', id: 'example-start', x: 110, y: 80,
      inputs: {
        DO: { block: {
          type: 'py_adc_setup', fields: { PIN: '26' }, next: { block: {
            type: 'py_led_setup', fields: { PIN: '3' }, next: { block: {
              type: 'py_forever', inputs: { DO: { block: {
                type: 'py_wait', fields: { SECONDS: 0.2 }, next: { block: {
                  type: 'controls_if', inputs: {
                    IF0: { block: { type: 'logic_compare', fields: { OP: 'GT' }, inputs: {
                      A: { block: { type: 'py_adc_read', fields: { PIN: '26' } } },
                      B: { block: { type: 'math_number', fields: { NUM: 2000 } } }
                    } } },
                    DO0: { block: { type: 'py_led_write', fields: { PIN: '3', STATE: '1' } } },
                    ELSE: { block: { type: 'py_led_write', fields: { PIN: '3', STATE: '0' } } }
                  }, extraState: { hasElse: true } } } }
              } } }
            } } } }
          } } }
        } }
      }
    }]
  }
};

export function newProject(name = '新建项目', demo = false): Project {
  return {
    id: crypto.randomUUID(), name,
    updatedAt: new Date().toISOString(), board: 'generic',
    workspace: demo ? structuredClone(DEMO_WORKSPACE) : { blocks: { languageVersion: 0, blocks: [] } },
  };
}

export function parseProjects(raw: string | null): Project[] {
  if (!raw) return [];
  try {
    const items: unknown = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    return items.filter((p): p is Project => {
      if (typeof p !== 'object' || p === null) return false;
      const item = p as Partial<Project>;
      return typeof item.id === 'string' && typeof item.name === 'string' &&
        ['generic', 'esp32', 'pico'].includes(String(item.board)) &&
        !!item.workspace && typeof item.workspace === 'object';
    });
  } catch { return []; }
}

export function validateProjectImport(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('不是有效的项目 JSON');
  const p = value as Partial<Project>;
  if (!p.workspace || typeof p.workspace !== 'object' || Array.isArray(p.workspace) ||
    !('blocks' in p.workspace)) throw new Error('缺少 Blockly workspace 数据');
  return {
    id: crypto.randomUUID(),
    name: typeof p.name === 'string' ? p.name.slice(0, 80) : '导入的项目',
    board: ['generic','esp32','pico'].includes(String(p.board)) ? p.board as Board : 'generic',
    updatedAt: new Date().toISOString(), workspace: p.workspace,
  };
}

export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 64) || 'project';
}
