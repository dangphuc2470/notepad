import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import './StatusBar.css';

export const StatusBar: React.FC = () => {
    const cursor = useEditorStore((s) => s.cursorPosition);
    const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
    const zoom = useSettingsStore((s) => s.zoom);
    const showStatusBar = useSettingsStore((s) => s.showStatusBar);

    const [stats, setStats] = useState({ charCount: 0, lineCount: 1 });

    useEffect(() => {
        if (!activeTab) {
            setStats({ charCount: 0, lineCount: 1 });
            return;
        }
        const content = activeTab.content;
        const charCount = content.length;
        let lineCount = 1;
        let pos = 0;
        while ((pos = content.indexOf('\n', pos)) !== -1) {
            lineCount++;
            pos++;
        }
        setStats({ charCount, lineCount });
    }, [activeTab?.content]);

    if (!showStatusBar || !activeTab) return null;

    return (
        <div className="status-bar">
            <div className="status-left">
                <span className="status-item">
                    Ln {cursor.line}, Col {cursor.col}
                </span>
                <span className="status-item">
                    {stats.charCount} characters
                </span>
                <span className="status-item">
                    {stats.lineCount} lines
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
