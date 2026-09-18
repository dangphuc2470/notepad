import { EditorView } from '@codemirror/view';
import { undo, redo, selectAll, deleteCharForward } from '@codemirror/commands';
import { invoke } from '@tauri-apps/api/core';

let view: EditorView | null = null;

export function setNotepadView(next: EditorView | null) {
    view = next;
}

export function getNotepadView(): EditorView | null {
    return view;
}

export function notepadGetText(): string {
    return view ? view.state.doc.toString() : '';
}

export function notepadSetText(text: string) {
    if (!view) return;
    view.focus();
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
    });
}

export function notepadInsertText(text: string) {
    if (!view) return;
    view.focus();
    view.dispatch(view.state.replaceSelection(text));
}

export function notepadSelectRange(from: number, to: number) {
    if (!view) return;
    const len = view.state.doc.length;
    const a = Math.max(0, Math.min(from, len));
    const b = Math.max(0, Math.min(to, len));
    view.focus();
    view.dispatch({
        selection: { anchor: a, head: b },
        scrollIntoView: true,
    });
}

export function notepadReplaceRange(from: number, to: number, text: string) {
    if (!view) return;
    const len = view.state.doc.length;
    const a = Math.max(0, Math.min(from, len));
    const b = Math.max(0, Math.min(to, len));
    view.focus();
    view.dispatch({
        changes: { from: a, to: b, insert: text },
        selection: { anchor: a, head: a + text.length },
        scrollIntoView: true,
    });
}

export function notepadUndo() {
    if (!view) return;
    view.focus();
    undo(view);
}

export function notepadRedo() {
    if (!view) return;
    view.focus();
    redo(view);
}

export function notepadSelectAll() {
    if (!view) return;
    view.focus();
    selectAll(view);
}

export function notepadDeleteSelection() {
    if (!view) return;
    view.focus();
    if (view.state.selection.main.empty) {
        deleteCharForward(view);
    } else {
        view.dispatch(view.state.replaceSelection(''));
    }
}

export function notepadGetSelectedText(): string {
    if (!view) return '';
    const { from, to } = view.state.selection.main;
    if (from === to) return '';
    const text = view.state.sliceDoc(from, to);
    const newline = text.search(/\r?\n/);
    return newline === -1 ? text : text.slice(0, newline);
}

export async function notepadExecClipboard(command: 'cut' | 'copy' | 'paste') {
    if (!view) return;
    const editor = view;
    editor.focus();
    try {
        if (command === 'paste') {
            const text = await invoke<string>('clipboard_read_text');
            if (!view || !text) return;
            view.focus();
            view.dispatch(view.state.replaceSelection(text));
            return;
        }
        const { from, to } = editor.state.selection.main;
        if (from === to) return;
        const selected = editor.state.sliceDoc(from, to);
        await invoke('clipboard_write_text', { text: selected });
        if (command === 'cut' && view === editor && editor.state.sliceDoc(from, to) === selected) {
            editor.dispatch({
                changes: { from, to, insert: '' },
                selection: { anchor: from },
            });
        }
    } catch (err) {
        console.error(`Clipboard ${command} failed:`, err);
    }
}

export function notepadIsEditorTarget(el: EventTarget | null): boolean {
    if (!el || !(el instanceof Element)) return false;
    return !!el.closest('.cm-editor');
}
