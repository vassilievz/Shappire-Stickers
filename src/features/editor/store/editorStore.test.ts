import { beforeEach, describe, expect, it } from 'vitest';
import { createImageElement, createTextElement, type EditorElement } from '@/domain/editor/elements';
import { createHistory } from '@/domain/editor/history';
import { useEditorStore } from './editorStore';

function image(name: string): EditorElement {
  return createImageElement({
    assetPath: `projects/p/assets/${name}.png`,
    naturalWidth: 100,
    naturalHeight: 100,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    name,
  });
}

function store() {
  return useEditorStore.getState();
}

function presentNames(): string[] {
  return store().history.present.map((element) => element.name);
}

beforeEach(() => {
  store().resetEditor();
  useEditorStore.setState({ history: createHistory<EditorElement[]>([]) });
});

describe('projetos', () => {
  it('abre um projeto novo limpo', () => {
    store().openNewProject('Teste');
    expect(store().projectId).toMatch(/^prj_/);
    expect(store().projectName).toBe('Teste');
    expect(store().history.present).toHaveLength(0);
    expect(store().dirty).toBe(false);
  });

  it('hidrata um projeto salvo', () => {
    const element = image('a');
    store().hydrateProject({
      id: 'prj_x',
      name: 'Salvo',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      canvas: { width: 512, height: 512 },
      elements: [element],
      thumbnail: null,
      packId: null,
    });
    expect(store().projectId).toBe('prj_x');
    expect(store().history.present).toHaveLength(1);
    expect(store().dirty).toBe(false);
  });
});

describe('histórico e mutações', () => {
  it('registra uma operação e permite desfazer/refazer', () => {
    store().commit((elements) => [...elements, image('a')]);
    expect(presentNames()).toEqual(['a']);
    expect(store().dirty).toBe(true);
    expect(store().canUndo()).toBe(true);

    store().undo();
    expect(presentNames()).toEqual([]);
    expect(store().canRedo()).toBe(true);

    store().redo();
    expect(presentNames()).toEqual(['a']);
  });

  it('atualização transiente não cria operação no histórico', () => {
    store().commit((elements) => [...elements, image('a')]);
    const depthBefore = store().history.past.length;

    store().transient((elements) =>
      elements.map((element) => (element.kind === 'image' ? { ...element, x: 50 } : element)),
    );
    expect(store().history.past).toHaveLength(depthBefore);
    const moved = store().history.present[0];
    if (moved?.kind === 'image') expect(moved.x).toBe(50);
  });

  it('reordena camadas pela ação de Comando', () => {
    const first = image('a');
    const second = image('b');
    store().commit(() => [first, second]);

    store().reorder(second.id, 'back');
    expect(presentNames()).toEqual(['b', 'a']);
  });

  it('alterna visibilidade e trava', () => {
    const element = image('a');
    store().commit(() => [element]);

    store().toggleVisibility(element.id);
    expect(store().history.present[0]?.visible).toBe(false);
    store().toggleLock(element.id);
    expect(store().history.present[0]?.locked).toBe(true);
  });

  it('remove elementos e limpa a seleção', () => {
    const element = image('a');
    store().commit(() => [element]);
    store().selectOnly(element.id);
    expect(store().selectedIds).toEqual([element.id]);

    store().removeElements([element.id]);
    expect(store().history.present).toHaveLength(0);
    expect(store().selectedIds).toHaveLength(0);
  });
});

describe('edição de texto', () => {
  it('agrupa todas as alterações de uma sessão em uma única operação', () => {
    const text = createTextElement({ text: 'Oi', x: 0, y: 0, width: 40, height: 20 });
    store().commit(() => [text]);
    const pastBefore = store().history.past.length;
    const baselineLength = store().history.present[0]?.kind;

    store().beginTextEdit(text.id);
    store().transient((elements) =>
      elements.map((element) => (element.id === text.id ? { ...element, text: 'Oi!' } : element)),
    );
    store().transient((elements) =>
      elements.map((element) => (element.id === text.id ? { ...element, text: 'Oi!!' } : element)),
    );
    store().endTextEdit();

    const current = store().history.present[0];
    expect(current?.kind).toBe('text');
    if (current?.kind === 'text') expect(current.text).toBe('Oi!!');
    expect(store().history.past).toHaveLength(pastBefore + 1);

    store().undo();
    const afterUndo = store().history.present[0];
    if (afterUndo?.kind === 'text') expect(afterUndo.text).toBe('Oi');
    expect(baselineLength).toBe('text');
  });

  it('não cria operação quando a edição não altera o texto', () => {
    const text = createTextElement({ text: 'Oi', x: 0, y: 0, width: 40, height: 20 });
    store().commit(() => [text]);
    const pastBefore = store().history.past.length;

    store().beginTextEdit(text.id);
    store().endTextEdit();

    expect(store().history.past).toHaveLength(pastBefore);
    expect(store().textEditBaseline).toBeNull();
  });
});
