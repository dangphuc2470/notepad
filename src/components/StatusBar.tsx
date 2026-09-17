import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import './StatusBar.css';

export const StatusBar: React.FC = () => {
    const { tabs, activeTabId } = useEditorStore();
    const { zoom, showStatusBar } = useSettingsStore();
    const activeTab = tabs.find((t) => t.id === activeTabId);

    const { charCount, lineCount } = React.useMemo(() => {
        if (!activeTab) return { charCount: 0, lineCount: 0 };
        const content = activeTab.content;
        let lines = 1;
        for (let i = 0; i < content.length; i++) {
            if (content.charCodeAt(i) === 10) lines++;
        }
        return { charCount: content.length, lineCount: lines };
    }, [activeTab?.content]);

    if (!showStatusBar || !activeTab) return null;

    return (
        <div className="status-bar">
            <div className="status-left">
                <span className="status-item">
                    Ln {activeTab.cursorLine}, Col {activeTab.cursorCol}
                </span>
                <span className="status-item">
                    {charCount} characters
                </span>
                <span className="status-item">
                    {lineCount} lines
                </span>
            </div>
            <div className="status-right">
                <span className="status-item">{zoom}%</span>
                <span className="status-item">{activeTab.encoding}</span>
                <span className="status-item">{activeTab.lineEnding}</span>
            </div>
        </div>
    );
};
