import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { openFileToTab, saveTab, saveAsTab } from './useFileOperations';
import { notepadGetSelectedText } from '../editor/notepadEditor';

export function useNativeMenuEvents() {
    useEffect(() => {
        let unlisten: (() => void) | undefined;

        listen<string>('menu-action', (event) => {
            const action = event.payload;
            const editorStore = useEditorStore.getState();
            const settingsStore = useSettingsStore.getState();

            switch (action) {
                case 'new-tab':
                    editorStore.addTab();
                    break;

                case 'reopen-closed-tab':
                    editorStore.reopenClosedTab();
                    break;

                case 'new-window': {
                    const tab = editorStore.getActiveTab();
                    if (tab) {
                        editorStore.detachTab(tab.id);
                    } else {
                        editorStore.addTab();
                    }
                    break;
                }

                case 'open-file':
                    void openFileToTab();
                    break;

                case 'save-file':
                    void saveTab();
                    break;

                case 'save-as-file':
                    void saveAsTab();
                    break;

                case 'toggle-auto-save':
                    settingsStore.toggleAutoSave();
                    break;

                case 'close-tab':
                    window.dispatchEvent(new CustomEvent('request-close-tab'));
                    break;

                case 'find':
                    settingsStore.toggleFindReplace('find', notepadGetSelectedText() || undefined);
                    break;

                case 'replace':
                    settingsStore.toggleFindReplace('replace', notepadGetSelectedText() || undefined);
                    break;

                case 'zoom-in':
                    settingsStore.zoomIn();
                    break;

                case 'zoom-out':
                    settingsStore.zoomOut();
                    break;

                case 'reset-zoom':
                    settingsStore.resetZoom();
                    break;

                case 'toggle-word-wrap':
                    settingsStore.toggleWordWrap();
                    break;

                case 'toggle-status-bar':
                    settingsStore.toggleStatusBar();
                    break;

                case 'check-updates':
                    openUrl('https://github.com/dangphuc2470/notepad/releases/latest').catch(console.error);
                    break;
            }
        })
            .then((u) => {
                unlisten = u;
            })
            .catch(console.error);

        return () => {
            unlisten?.();
        };
    }, []);
}
