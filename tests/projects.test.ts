import { describe, expect, it } from 'vitest';
import { DEMO_WORKSPACE, newProject, parseProjects, safeFilename, validateProjectImport } from '../src/core/projects';

describe('project persistence and validation', () => {
  it('creates a valid demo project',()=>{
    const p=newProject('demo',true);
    expect(p.workspace).toEqual(DEMO_WORKSPACE);
    expect(p.workspace).not.toBe(DEMO_WORKSPACE);
    expect(p.board).toBe('generic');
  });
  it('parses valid entries and rejects malformed storage',()=>{
    const p=newProject('good');
    expect(parseProjects(JSON.stringify([p,{},null]))).toEqual([p]);
    expect(parseProjects('{invalid')).toEqual([]);
  });
  it('validates imports and generates new ids',()=>{
    const p=newProject('existing');
    expect(validateProjectImport(p).id).not.toBe(p.id);
    expect(()=>validateProjectImport({name:'invalid'})).toThrow();
  });
  it('escapes filename delimiters',()=>{
    expect(safeFilename('bad/\\name:demo')).toBe('bad__name_demo');
  });
});
