import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { saveTab } from '../hooks/useFileOperations';
import './Editor.css';

export const Editor: React.FC = () => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingContentRef = useRef<string | null>(null);
    const contentSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cursorRafRef = useRef<number | null>(null);
    const lastSyncedContentRef = useRef<string>('');

    const activeTabId = useEditorStore((s) => s.activeTabId);
    const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
    const markTabDirty = useEditorStore((s) => s.markTabDirty);
    const updateContent = useEditorStore((s) => s.updateContent);
    const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
    const updateScrollTop = useEditorStore((s) => s.updateScrollTop);
    const registerFlushContent = useEditorStore((s) => s.registerFlushContent);

    const { wordWrap, zoom, fontFamily, fontSize, autoSave } = useSettingsStore();

    const activeTabRef = useRef(activeTab);
    activeTabRef.current = activeTab;

    const flushPendingContent = useCallback(() => {
        if (contentSyncTimerRef.current) {
            clearTimeout(contentSyncTimerRef.current);
            contentSyncTimerRef.current = null;
        }
        if (pendingContentRef.current !== null && activeTabRef.current) {
            const val = pendingContentRef.current;
            pendingContentRef.current = null;
            lastSyncedContentRef.current = val;
            updateContent(activeTabRef.current.id, val);
        }
    }, [updateContent]);

    // Register flush callback so save/session actions can commit pending typing synchronously
    useEffect(() => {
        return registerFlushContent(flushPendingContent);
    }, [registerFlushContent, flushPendingContent]);

    // Flush pending changes before switching tabs
    const prevTabIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (prevTabIdRef.current && prevTabIdRef.current !== activeTabId) {
            flushPendingContent();
        }
        prevTabIdRef.current = activeTabId;
    }, [activeTabId, flushPendingContent]);

    const updateCursorPosition = useCallback(() => {
        if (cursorRafRef.current !== null) {
            cancelAnimationFrame(cursorRafRef.current);
        }
        cursorRafRef.current = requestAnimationFrame(() => {
            cursorRafRef.current = null;
            const textarea = textareaRef.current;
            if (!textarea) return;

            const val = textarea.value;
            const selStart = textarea.selectionStart;

            const lastNewline = val.lastIndexOf('\n', selStart - 1);
            const col = selStart - lastNewline;

            let line = 1;
            let pos = 0;
            while ((pos = val.indexOf('\n', pos)) !== -1 && pos < selStart) {
                line++;
                pos++;
            }

            setCursorPosition(line, col);
        });
    }, [setCursorPosition]);

    // Sync textarea value with store content (external updates, undo/redo, or file loads)
    useEffect(() => {
        if (!activeTab || !textareaRef.current) return;
        if (lastSyncedContentRef.current === activeTab.content) return;
        lastSyncedContentRef.current = activeTab.content;

        const scrollPos = textareaRef.current.scrollTop;
        const selStart = textareaRef.current.selectionStart;
        const selEnd = textareaRef.current.selectionEnd;
        textareaRef.current.value = activeTab.content;
        textareaRef.current.scrollTop = scrollPos;
        textareaRef.current.selectionStart = selStart;
        textareaRef.current.selectionEnd = selEnd;
    }, [activeTab?.content]);

    // Focus and restore scroll on tab switch
    useEffect(() => {
        if (textareaRef.current && activeTab) {
            lastSyncedContentRef.current = activeTab.content;
            textareaRef.current.value = activeTab.content;
            textareaRef.current.scrollTop = activeTab.scrollTop;
            textareaRef.current.focus();
            updateCursorPosition();
        }
    }, [activeTabId]);

    // Auto-save debounced (1000ms after content is committed) for tabs with an existing filePath
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

    // Auto-save immediately when window loses focus (blur)
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

    const handleInput = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const tab = activeTabRef.current;
            if (!tab) return;
            const val = e.target.value;
            pendingContentRef.current = val;

            if (!tab.isDirty) {
                markTabDirty(tab.id);
            }

            if (contentSyncTimerRef.current) {
                clearTimeout(contentSyncTimerRef.current);
            }
            contentSyncTimerRef.current = setTimeout(() => {
                flushPendingContent();
            }, 200);

            updateCursorPosition();
        },
        [markTabDirty, flushPendingContent, updateCursorPosition]
    );

    const handleBlur = useCallback(() => {
        flushPendingContent();
    }, [flushPendingContent]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '\t');
            }
        },
        []
    );

    const handleScroll = useCallback(() => {
        if (textareaRef.current && activeTabRef.current) {
            updateScrollTop(activeTabRef.current.id, textareaRef.current.scrollTop);
        }
    }, [updateScrollTop]);

    const handleClick = useCallback(() => {
        updateCursorPosition();
    }, [updateCursorPosition]);

    const handleKeyUp = useCallback(() => {
        updateCursorPosition();
    }, [updateCursorPosition]);

    if (!activeTab) {
        return <div className="editor-empty">No tabs open</div>;
    }

    const scaledFontSize = (fontSize * zoom) / 100;

    return (
        <div className="editor-container">
            <textarea
                ref={textareaRef}
                className="editor-textarea"
                defaultValue={activeTab.content}
                onChange={handleInput}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onClick={handleClick}
                onScroll={handleScroll}
                spellCheck={false}
                style={{
                    fontFamily,
                    fontSize: `${scaledFontSize}px`,
                    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                    overflowWrap: wordWrap ? 'break-word' : 'normal',
                    wordBreak: 'normal',
                }}
            />
        </div>
    );
};
