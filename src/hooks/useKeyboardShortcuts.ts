import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useFileOperations } from './useFileOperations';
import { notepadInsertText, notepadIsEditorTarget, notepadGetSelectedText, notepadRedo, notepadUndo } from '../editor/notepadEditor';

export const useKeyboardShortcuts = () => {
    const { handleOpen, handleSave, handleSaveAs } = useFileOperations();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMeta = e.metaKey;
            const isShift = e.shiftKey;

            if (!isMeta) {
                if (e.key === 'F5') {
                    e.preventDefault();
                    const now = new Date();
                    const dateStr = `${now.toLocaleTimeString()} ${now.toLocaleDateString()}`;
                    notepadInsertText(dateStr);
                }
                return;
            }

            const editorStore = useEditorStore.getState();
            const settingsStore = useSettingsStore.getState();

            switch (e.key.toLowerCase()) {
                case 't':
                    e.preventDefault();
                    if (isShift) {
                        // Cmd+Shift+T = Reopen recently closed tab
                        editorStore.reopenClosedTab();
                    } else {
                        // Cmd+T = New tab
                        editorStore.addTab();
                    }
                    break;

                case 'n':
                    e.preventDefault();
                    if (isShift) {
                        // Cmd+Shift+N = New Window (detach tab if exists)
                        const tab = editorStore.getActiveTab();
                        if (tab) {
                            editorStore.detachTab(tab.id);
                        } else {
                            editorStore.addTab();
                        }
                    } else {
                        // Cmd+N = New Tab
                        editorStore.addTab();
                    }
                    break;

                case 'o':
                    e.preventDefault();
                    handleOpen();
                    break;

                case 's':
                    e.preventDefault();
                    if (isShift) {
                        handleSaveAs();
                    } else {
                        handleSave();
                    }
                    break;

                case 'w':
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('request-close-tab'));
                    break;

                case 'f':
                    e.preventDefault();
                    settingsStore.toggleFindReplace('find', notepadGetSelectedText() || undefined);
                    break;

                case 'h':
                    e.preventDefault();
                    settingsStore.toggleFindReplace('replace', notepadGetSelectedText() || undefined);
                    break;

                case 'z': {
                    const el = document.activeElement;
                    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                        return;
                    }
                    if (notepadIsEditorTarget(el)) {
                        return;
                    }
                    e.preventDefault();
                    if (isShift) {
                        notepadRedo();
                    } else {
                        notepadUndo();
                    }
                    break;
                }

                case 'y': {
                    const el = document.activeElement;
                    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                        return;
                    }
                    if (notepadIsEditorTarget(el)) {
                        return;
                    }
                    e.preventDefault();
                    notepadRedo();
                    break;
                }

                case '=':
                case '+':
                    e.preventDefault();
                    settingsStore.zoomIn();
                    break;

                case '-':
                    e.preventDefault();
                    settingsStore.zoomOut();
                    break;

                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9': {
                    e.preventDefault();
                    const digit = parseInt(e.key, 10);
                    const tabs = editorStore.tabs;
                    if (tabs.length === 0) break;
                    if (digit === 9) {
                        // Cmd+9 = Switch to the last tab (macOS standard)
                        editorStore.setActiveTab(tabs[tabs.length - 1].id);
                    } else {
                        const targetIndex = digit - 1;
                        if (targetIndex < tabs.length) {
                            editorStore.setActiveTab(tabs[targetIndex].id);
                        }
                    }
                    break;
                }

                case '0':
                    e.preventDefault();
                    settingsStore.resetZoom();
                    break;
            }
        };

        // Handle zoom with scroll
        const handleWheel = (e: WheelEvent) => {
            if (e.metaKey) {
                e.preventDefault();
                const settingsStore = useSettingsStore.getState();
                if (e.deltaY < 0) {
                    settingsStore.zoomIn();
                } else {
                    settingsStore.zoomOut();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [handleOpen, handleSave, handleSaveAs]);
};
