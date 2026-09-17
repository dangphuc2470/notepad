import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { saveTab } from '../hooks/useFileOperations';
import './Editor.css';

export const Editor: React.FC = () => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLocalInputRef = useRef(false);
    const lastUndoTimeRef = useRef(0);

    const {
        tabs,
        activeTabId,
        updateContent,
        updateCursor,
        updateScrollTop,
        pushUndo,
    } = useEditorStore();
    const { wordWrap, zoom, fontFamily, fontSize, autoSave } = useSettingsStore();

    const activeTab = tabs.find((t) => t.id === activeTabId);

    const updateCursorPosition = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea || !activeTab) return;

        const value = textarea.value;
        const selStart = textarea.selectionStart;
        let line = 1;
        let lastNewline = -1;
        for (let i = 0; i < selStart; i++) {
            if (value.charCodeAt(i) === 10) {
                line++;
                lastNewline = i;
            }
        }
        const col = selStart - lastNewline;
        updateCursor(activeTab.id, line, col);
    }, [activeTab?.id, updateCursor]);

    // Sync textarea value with store content (only for external updates, undo/redo, or tab switches)
    useEffect(() => {
        if (isLocalInputRef.current) return;
        if (textareaRef.current && activeTab) {
            if (textareaRef.current.value !== activeTab.content) {
                const scrollPos = textareaRef.current.scrollTop;
                const selStart = textareaRef.current.selectionStart;
                const selEnd = textareaRef.current.selectionEnd;
                textareaRef.current.value = activeTab.content;
                textareaRef.current.scrollTop = scrollPos;
                textareaRef.current.selectionStart = selStart;
                textareaRef.current.selectionEnd = selEnd;
            }
        }
    }, [activeTab?.content]);

    // Focus and restore scroll on tab switch
    useEffect(() => {
        if (textareaRef.current && activeTab) {
            textareaRef.current.value = activeTab.content;
            textareaRef.current.scrollTop = activeTab.scrollTop;
            textareaRef.current.focus();
            updateCursorPosition();
        }
    }, [activeTabId]);

    // Auto-save debounced (1000ms after user stops typing) for tabs with an existing filePath
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
            const currentTab = useEditorStore.getState().getActiveTab();
            const { autoSave: isAutoSave } = useSettingsStore.getState();
            if (isAutoSave && currentTab?.filePath && currentTab.isDirty) {
                saveTab(currentTab.id);
            }
        };
        window.addEventListener('blur', handleWindowBlur);
        return () => window.removeEventListener('blur', handleWindowBlur);
    }, []);

    const handleInput = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            if (!activeTab) return;
            isLocalInputRef.current = true;
            updateContent(activeTab.id, e.target.value);
            updateCursorPosition();
            requestAnimationFrame(() => {
                isLocalInputRef.current = false;
            });
        },
        [activeTab?.id, updateContent, updateCursorPosition]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (!activeTab) return;
            const now = Date.now();
            const shouldSnapshot =
                e.key === ' ' ||
                e.key === 'Enter' ||
                now - lastUndoTimeRef.current > 800;

            // Push undo state before typing starts, batched to avoid freezing on massive files
            if (
                (!e.metaKey && !e.ctrlKey && e.key.length === 1) ||
                e.key === 'Backspace' ||
                e.key === 'Delete'
            ) {
                if (shouldSnapshot) {
                    pushUndo(activeTab.id, activeTab.content);
                    lastUndoTimeRef.current = now;
                }
            }

            // Handle Tab key for indentation
            if (e.key === 'Tab') {
                e.preventDefault();
                pushUndo(activeTab.id, activeTab.content);
                lastUndoTimeRef.current = now;
                const textarea = textareaRef.current;
                if (!textarea) return;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const value = textarea.value;
                const newValue = value.substring(0, start) + '\t' + value.substring(end);
                isLocalInputRef.current = true;
                textarea.value = newValue;
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                updateContent(activeTab.id, newValue);
                requestAnimationFrame(() => {
                    isLocalInputRef.current = false;
                });
            }
        },
        [activeTab?.id, activeTab?.content, pushUndo, updateContent]
    );

    const handleScroll = useCallback(() => {
        if (textareaRef.current && activeTab) {
            updateScrollTop(activeTab.id, textareaRef.current.scrollTop);
        }
    }, [activeTab?.id, updateScrollTop]);

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
