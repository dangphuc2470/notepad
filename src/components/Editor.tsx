import React, { useRef, useEffect, useCallback } from 'react';
import { EditorView, keymap, drawSelection, dropCursor, ViewUpdate } from '@codemirror/view';
import { EditorSelection, EditorState, Compartment, Extension, Transaction } from '@codemirror/state';
import { history, historyKeymap, standardKeymap, insertNewline } from '@codemirror/commands';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { saveTab } from '../hooks/useFileOperations';
import { setNotepadView } from '../editor/notepadEditor';
import './Editor.css';

function insertTab(view: EditorView): boolean {
    view.dispatch(view.state.replaceSelection('\t'));
    return true;
}

function posFromLineCol(text: string, line: number, col: number): number {
    const targetLine = Math.max(1, line);
    let currentLine = 1;
    let index = 0;
    while (currentLine < targetLine) {
        const newline = text.indexOf('\n', index);
        if (newline === -1) return text.length;
        index = newline + 1;
        currentLine++;
    }
    const lineEnd = text.indexOf('\n', index);
    const end = lineEnd === -1 ? text.length : lineEnd;
    return Math.min(end, index + Math.max(0, col - 1));
}

function createEditorTheme(fontFamily: string, fontSize: number) {
    return EditorView.theme({
        '&': {
            height: '100%',
            fontSize: `${fontSize}px`,
            fontFamily,
        },
        '.cm-scroller': {
            fontFamily: 'inherit',
            lineHeight: '1.6',
        },
        '.cm-content': {
            fontFamily: 'inherit',
        },
    });
}

export const Editor: React.FC = () => {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const wrapCompartment = useRef(new Compartment());
    const themeCompartment = useRef(new Compartment());
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingDirtyRef = useRef(false);
    const contentSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cursorRafRef = useRef<number | null>(null);
    const lastSyncedContentRef = useRef('');
    const applyingExternalRef = useRef(false);
    const skipNextTabEffectRef = useRef(true);
    const tabStatesRef = useRef(new Map<string, EditorState>());
    const lastCursorRef = useRef({ line: 1, col: 1 });

    const activeTabId = useEditorStore((s) => s.activeTabId);
    const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
    const markTabDirty = useEditorStore((s) => s.markTabDirty);
    const updateContent = useEditorStore((s) => s.updateContent);
    const updateCursor = useEditorStore((s) => s.updateCursor);
    const updateScrollTop = useEditorStore((s) => s.updateScrollTop);
    const registerFlushContent = useEditorStore((s) => s.registerFlushContent);

    const { wordWrap, zoom, fontFamily, fontSize, autoSave } = useSettingsStore();

    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;
    const markTabDirtyRef = useRef(markTabDirty);
    markTabDirtyRef.current = markTabDirty;
    const updateContentRef = useRef(updateContent);
    updateContentRef.current = updateContent;
    const updateCursorRef = useRef(updateCursor);
    updateCursorRef.current = updateCursor;
    const updateScrollTopRef = useRef(updateScrollTop);
    updateScrollTopRef.current = updateScrollTop;

    const updateCursorPosition = useCallback((view: EditorView) => {
        if (cursorRafRef.current !== null) {
            cancelAnimationFrame(cursorRafRef.current);
        }
        cursorRafRef.current = requestAnimationFrame(() => {
            cursorRafRef.current = null;
            const tab = activeTabRef.current;
            if (!tab) return;
            const pos = view.state.selection.main.head;
            const line = view.state.doc.lineAt(pos);
            const col = pos - line.from + 1;
            if (lastCursorRef.current.line === line.number && lastCursorRef.current.col === col) {
                return;
            }
            lastCursorRef.current = { line: line.number, col };
            updateCursorRef.current(tab.id, line.number, col);
        });
    }, []);

    const flushPendingContent = useCallback(() => {
        if (contentSyncTimerRef.current) {
            clearTimeout(contentSyncTimerRef.current);
            contentSyncTimerRef.current = null;
        }
        const view = viewRef.current;
        const tab = activeTabRef.current;
        if (!pendingDirtyRef.current || !view || !tab) return;
        pendingDirtyRef.current = false;
        const val = view.state.doc.toString();
        lastSyncedContentRef.current = val;
        updateContentRef.current(tab.id, val);
    }, []);

    const onUpdateRef = useRef((_update: ViewUpdate) => {});
    onUpdateRef.current = (update: ViewUpdate) => {
        if (applyingExternalRef.current) {
            if (update.selectionSet) updateCursorPosition(update.view);
            return;
        }
        if (update.docChanged) {
            pendingDirtyRef.current = true;
            const tab = activeTabRef.current;
            if (tab && !tab.isDirty) {
                markTabDirtyRef.current(tab.id);
            }
            if (contentSyncTimerRef.current) {
                clearTimeout(contentSyncTimerRef.current);
            }
            contentSyncTimerRef.current = setTimeout(() => {
                flushPendingContent();
            }, 200);
        }
        if (update.docChanged || update.selectionSet) {
            updateCursorPosition(update.view);
        }
    };

    const buildExtensions = useCallback((): Extension[] => {
        const settings = useSettingsStore.getState();
        const scaled = (settings.fontSize * settings.zoom) / 100;
        return [
            history(),
            drawSelection(),
            dropCursor(),
            EditorState.tabSize.of(4),
            keymap.of([
                { key: 'Tab', run: insertTab },
                { key: 'Enter', run: insertNewline },
                ...historyKeymap,
                ...standardKeymap,
            ]),
            wrapCompartment.current.of(settings.wordWrap ? EditorView.lineWrapping : []),
            themeCompartment.current.of(createEditorTheme(settings.fontFamily, scaled)),
            EditorView.contentAttributes.of({ spellcheck: 'false' }),
            EditorView.updateListener.of((update) => onUpdateRef.current(update)),
            EditorView.domEventHandlers({
                blur: () => {
                    flushPendingContent();
                    return false;
                },
            }),
        ];
    }, [flushPendingContent]);

    useEffect(() => {
        return registerFlushContent(flushPendingContent);
    }, [registerFlushContent, flushPendingContent]);

    const prevTabIdRef = useRef<string | null>(null);

    const applyEditorSettings = useCallback((view: EditorView) => {
        const settings = useSettingsStore.getState();
        const scaled = (settings.fontSize * settings.zoom) / 100;
        view.dispatch({
            effects: [
                wrapCompartment.current.reconfigure(settings.wordWrap ? EditorView.lineWrapping : []),
                themeCompartment.current.reconfigure(createEditorTheme(settings.fontFamily, scaled)),
            ],
        });
    }, []);

    useEffect(() => {
        if (!hostRef.current || !activeTab) return;

        const tab = useEditorStore.getState().getActiveTab();
        const doc = tab?.content ?? '';
        lastSyncedContentRef.current = doc;
        pendingDirtyRef.current = false;

        const view = new EditorView({
            parent: hostRef.current,
            state: EditorState.create({
                doc,
                extensions: buildExtensions(),
                selection: EditorSelection.cursor(posFromLineCol(doc, tab?.cursorLine ?? 1, tab?.cursorCol ?? 1)),
            }),
        });
        view.scrollDOM.scrollTop = tab?.scrollTop ?? 0;
        viewRef.current = view;
        setNotepadView(view);
        view.focus();
        updateCursorPosition(view);

        const onScroll = () => {
            const current = activeTabRef.current;
            if (current) {
                updateScrollTopRef.current(current.id, view.scrollDOM.scrollTop);
            }
        };
        view.scrollDOM.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            view.scrollDOM.removeEventListener('scroll', onScroll);
            if (contentSyncTimerRef.current) {
                clearTimeout(contentSyncTimerRef.current);
                contentSyncTimerRef.current = null;
            }
            if (cursorRafRef.current !== null) {
                cancelAnimationFrame(cursorRafRef.current);
                cursorRafRef.current = null;
            }
            setNotepadView(null);
            view.destroy();
            viewRef.current = null;
        };
        // Recreate only when the editor host is shown/hidden, not on tab switch
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [Boolean(activeTab)]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        const prevId = prevTabIdRef.current;
        if (prevId && prevId !== activeTabId) {
            flushPendingContent();
            tabStatesRef.current.set(prevId, view.state);
            const pos = view.state.selection.main.head;
            const line = view.state.doc.lineAt(pos);
            updateCursorRef.current(prevId, line.number, pos - line.from + 1);
        }

        const liveIds = new Set(useEditorStore.getState().tabs.map((t) => t.id));
        for (const id of [...tabStatesRef.current.keys()]) {
            if (!liveIds.has(id)) tabStatesRef.current.delete(id);
        }

        const tab = useEditorStore.getState().getActiveTab();
        if (!tab) return;

        if (skipNextTabEffectRef.current) {
            skipNextTabEffectRef.current = false;
            prevTabIdRef.current = activeTabId;
            return;
        }

        lastSyncedContentRef.current = tab.content;
        pendingDirtyRef.current = false;
        applyingExternalRef.current = true;
        const cached = tabStatesRef.current.get(tab.id);
        if (cached && cached.doc.toString() === tab.content) {
            view.setState(cached);
            applyEditorSettings(view);
        } else {
            view.setState(
                EditorState.create({
                    doc: tab.content,
                    extensions: buildExtensions(),
                    selection: EditorSelection.cursor(posFromLineCol(tab.content, tab.cursorLine, tab.cursorCol)),
                })
            );
        }
        view.scrollDOM.scrollTop = tab.scrollTop;
        view.focus();
        updateCursorPosition(view);
        applyingExternalRef.current = false;
        prevTabIdRef.current = activeTabId;
    }, [activeTabId, applyEditorSettings, buildExtensions, flushPendingContent, updateCursorPosition]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view || !activeTab) return;
        if (lastSyncedContentRef.current === activeTab.content) return;
        lastSyncedContentRef.current = activeTab.content;
        applyingExternalRef.current = true;
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: activeTab.content },
            annotations: [Transaction.addToHistory.of(false)],
        });
        applyingExternalRef.current = false;
    }, [activeTab?.content]);

    useEffect(() => {
        if (!autoSave || !activeTab?.filePath || !activeTab.isDirty) {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            return;
        }

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            saveTab(activeTab.id);
        }, 1000);

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [activeTab?.content, activeTab?.filePath, activeTab?.isDirty, autoSave, activeTab?.id]);

    useEffect(() => {
        const handleWindowBlur = () => {
            flushPendingContent();
            const currentTab = useEditorStore.getState().getActiveTab();
            const { autoSave: isAutoSave } = useSettingsStore.getState();
            if (isAutoSave && currentTab?.filePath && currentTab.isDirty) {
                saveTab(currentTab.id);
            }
        };
        window.addEventListener('blur', handleWindowBlur);
        return () => window.removeEventListener('blur', handleWindowBlur);
    }, [flushPendingContent]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
            effects: wrapCompartment.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
        });
    }, [wordWrap]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const scaled = (fontSize * zoom) / 100;
        view.dispatch({
            effects: themeCompartment.current.reconfigure(createEditorTheme(fontFamily, scaled)),
        });
    }, [fontFamily, fontSize, zoom]);

    if (!activeTab) {
        return <div className="editor-empty">No tabs open</div>;
    }

    return (
        <div className="editor-container">
            <div ref={hostRef} className="editor-host" />
        </div>
    );
};
