import { EditorView } from '@codemirror/view';
import { undo, redo, selectAll, deleteCharForward } from '@codemirror/commands';

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

export function notepadExecClipboard(command: 'cut' | 'copy' | 'paste') {
    if (!view) return;
    view.focus();
    document.execCommand(command);
}

export function notepadIsEditorTarget(el: EventTarget | null): boolean {
    if (!el || !(el instanceof Element)) return false;
    return !!el.closest('.cm-editor');
}
