import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditorStore } from '../stores/editorStore';
import { getNotepadView, notepadReplaceRange, notepadSelectRange, notepadSetText } from '../editor/notepadEditor';
import './FindReplace.css';

function getDocText(fallback?: string): string {
    const editorView = getNotepadView();
    return editorView ? editorView.state.doc.toString() : fallback || '';
}

/** Decode find-box escapes (\\n, \\r, \\t, \\\\) then escape for RegExp. */
function buildSearchPattern(searchTerm: string, wholeWord: boolean): string {
    let literal = '';
    for (let i = 0; i < searchTerm.length; i++) {
        if (searchTerm[i] === '\\' && i + 1 < searchTerm.length) {
            const next = searchTerm[++i];
            if (next === 'n') literal += '\n';
            else if (next === 'r') literal += '\r';
            else if (next === 't') literal += '\t';
            else literal += next;
        } else {
            literal += searchTerm[i];
        }
    }
    const pattern = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return wholeWord ? `\\b${pattern}\\b` : pattern;
}

export const FindReplace: React.FC = () => {
    const { showFindReplace, findReplaceMode, findQuerySeed, openFindNonce, closeFindReplace, reduceMotion } = useSettingsStore();
    const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [matchCase, setMatchCase] = useState(false);
    const [wholeWord, setWholeWord] = useState(false);
    const [currentMatch, setCurrentMatch] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);

    const findInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!showFindReplace) return;
        if (findQuerySeed) {
            setSearchTerm(findQuerySeed);
        }
        const input = findInputRef.current;
        if (input) {
            input.focus();
            input.select();
        }
    }, [showFindReplace, findReplaceMode, findQuerySeed, openFindNonce]);

    const findMatches = useCallback((): Array<{ index: number; length: number }> => {
        if (!searchTerm) return [];
        const content = getDocText(activeTab?.content);
        if (!content) return [];
        const flags = matchCase ? 'g' : 'gi';
        const regex = new RegExp(buildSearchPattern(searchTerm, wholeWord), flags);
        const matches: Array<{ index: number; length: number }> = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            matches.push({ index: match.index, length: match[0].length });
            if (match[0].length === 0) regex.lastIndex++;
        }
        return matches;
    }, [activeTab?.content, searchTerm, matchCase, wholeWord]);

    useEffect(() => {
        const positions = findMatches();
        setTotalMatches(positions.length);
        if (currentMatch >= positions.length) {
            setCurrentMatch(positions.length > 0 ? 0 : 0);
        }
    }, [searchTerm, matchCase, wholeWord, activeTab?.content, findMatches]);

    const navigateMatch = (direction: 'next' | 'prev') => {
        const positions = findMatches();
        if (positions.length === 0) return;

        let newIndex = currentMatch;
        if (direction === 'next') {
            newIndex = (currentMatch + 1) % positions.length;
        } else {
            newIndex = (currentMatch - 1 + positions.length) % positions.length;
        }
        setCurrentMatch(newIndex);
        const pos = positions[newIndex].index;
        notepadSelectRange(pos, pos + positions[newIndex].length);
    };

    const handleReplace = () => {
        if (totalMatches === 0) return;
        const positions = findMatches();
        if (positions.length === 0) return;

        const pos = positions[currentMatch];
        notepadReplaceRange(pos.index, pos.index + pos.length, replaceTerm);
        useEditorStore.getState().flushPendingContent();
    };

    const handleReplaceAll = () => {
        if (totalMatches === 0) return;
        const content = getDocText(activeTab?.content);
        const flags = matchCase ? 'g' : 'gi';
        const regex = new RegExp(buildSearchPattern(searchTerm, wholeWord), flags);
        notepadSetText(content.replace(regex, replaceTerm));
        useEditorStore.getState().flushPendingContent();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeFindReplace();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            navigateMatch(e.shiftKey ? 'prev' : 'next');
        }
    };

    if (!showFindReplace && reduceMotion) return null;

    return (
        <div
            className={`find-replace-slot${showFindReplace ? ' is-open' : ''}${reduceMotion ? ' reduce-motion' : ''}`}
            aria-hidden={!showFindReplace}
        >
            <div className="find-replace-slot-inner">
                <div className="find-replace-bar" onKeyDown={handleKeyDown}>
            <div className="find-row">
                <div className="find-input-group">
                    <input
                        ref={findInputRef}
                        type="text"
                        className="find-input"
                        placeholder="Find"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        tabIndex={showFindReplace ? 0 : -1}
                    />
                    <span className="match-count">
                        {searchTerm ? `${totalMatches > 0 ? currentMatch + 1 : 0} of ${totalMatches}` : 'No results'}
                    </span>
                </div>

                <div className="find-actions">
                    <button
                        className={`find-toggle ${matchCase ? 'active' : ''}`}
                        onClick={() => setMatchCase(!matchCase)}
                        title="Match Case"
                    >
                        Aa
                    </button>
                    <button
                        className={`find-toggle ${wholeWord ? 'active' : ''}`}
                        onClick={() => setWholeWord(!wholeWord)}
                        title="Whole Word"
                    >
                        W
                    </button>
                    <button className="find-btn" onClick={() => navigateMatch('prev')} title="Previous (Shift+Enter)">
                        ↑
                    </button>
                    <button className="find-btn" onClick={() => navigateMatch('next')} title="Next (Enter)">
                        ↓
                    </button>
                    <button className="find-close" onClick={closeFindReplace} title="Close (Esc)">
                        ×
                    </button>
                </div>
            </div>

            {findReplaceMode === 'replace' && (
                <div className="replace-row">
                    <div className="find-input-group">
                        <input
                            type="text"
                            className="find-input"
                            placeholder="Replace"
                            value={replaceTerm}
                            onChange={(e) => setReplaceTerm(e.target.value)}
                            tabIndex={showFindReplace ? 0 : -1}
                        />
                    </div>
                    <div className="find-actions">
                        <button className="find-btn replace-btn" onClick={handleReplace} title="Replace">
                            Replace
                        </button>
                        <button className="find-btn replace-btn" onClick={handleReplaceAll} title="Replace All">
                            All
                        </button>
                    </div>
                </div>
            )}
                </div>
            </div>
        </div>
    );
};
