import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditorStore } from '../stores/editorStore';
import {
    getNotepadView,
    notepadReplaceRange,
    notepadSelectRange,
    notepadSetText,
    notepadSetSearchMatches,
    notepadClearSearchMatches,
} from '../editor/notepadEditor';
import './FindReplace.css';

function getDocText(fallback?: string): string {
    const editorView = getNotepadView();
    return editorView ? editorView.state.doc.toString() : fallback || '';
}

/** Decode find-box escapes (\n, \r, \t, \\) then escape for RegExp. */
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
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!wholeWord) return escaped;

    const chars = Array.from(literal);
    if (chars.length === 0) return escaped;

    // Word characters across all human languages (letters, marks, digits, underscores)
    const isWordChar = (char: string) => /[\p{L}\p{M}\p{N}_]/u.test(char);
    const startsWithWord = isWordChar(chars[0]);
    const endsWithWord = isWordChar(chars[chars.length - 1]);

    const prefix = startsWithWord ? '(?<![\\p{L}\\p{M}\\p{N}_])' : '';
    const suffix = endsWithWord ? '(?![\\p{L}\\p{M}\\p{N}_])' : '';

    return `${prefix}${escaped}${suffix}`;
}

export const FindReplace: React.FC = () => {
    const {
        showFindReplace,
        findReplaceMode,
        findQuerySeed,
        openFindNonce,
        closeFindReplace,
        setFindReplaceMode,
        reduceMotion,
    } = useSettingsStore();
    const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));

    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [matchCase, setMatchCase] = useState(false);
    const [wholeWord, setWholeWord] = useState(false);
    const [currentMatch, setCurrentMatch] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);

    const findInputRef = useRef<HTMLInputElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!showFindReplace) return;
        if (findQuerySeed) {
            setSearchTerm(findQuerySeed);
        }
        if (findReplaceMode === 'replace') {
            const rInput = replaceInputRef.current;
            if (rInput && !findQuerySeed) {
                rInput.focus();
                rInput.select();
                return;
            }
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
        try {
            const flags = matchCase ? 'gu' : 'giu';
            const regex = new RegExp(buildSearchPattern(searchTerm, wholeWord), flags);
            const matches: Array<{ index: number; length: number }> = [];
            let match;
            while ((match = regex.exec(content)) !== null) {
                matches.push({ index: match.index, length: match[0].length });
                if (match[0].length === 0) regex.lastIndex++;
            }
            return matches;
        } catch {
            return [];
        }
    }, [activeTab?.content, searchTerm, matchCase, wholeWord]);

    useEffect(() => {
        if (!showFindReplace) {
            notepadClearSearchMatches();
            return;
        }
        const positions = findMatches();
        setTotalMatches(positions.length);
        if (positions.length === 0) {
            setCurrentMatch(0);
            notepadClearSearchMatches();
            return;
        }

        const editorView = getNotepadView();
        const cursor = editorView ? editorView.state.selection.main.from : 0;

        let targetIndex = positions.findIndex((p) => p.index >= cursor);
        if (targetIndex === -1) {
            targetIndex = 0;
        }
        setCurrentMatch(targetIndex);

        const pos = positions[targetIndex];
        notepadSelectRange(pos.index, pos.index + pos.length, false);
        notepadSetSearchMatches(positions, targetIndex);
    }, [searchTerm, matchCase, wholeWord, activeTab?.content, showFindReplace, findMatches]);

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
        const pos = positions[newIndex];
        notepadSelectRange(pos.index, pos.index + pos.length, false);
        notepadSetSearchMatches(positions, newIndex);
    };

    const handleReplace = () => {
        if (totalMatches === 0) return;
        const positions = findMatches();
        if (positions.length === 0) return;

        const pos = positions[currentMatch] || positions[0];
        notepadReplaceRange(pos.index, pos.index + pos.length, replaceTerm);
        useEditorStore.getState().flushPendingContent();
    };

    const handleReplaceAll = () => {
        if (totalMatches === 0) return;
        const content = getDocText(activeTab?.content);
        try {
            const flags = matchCase ? 'gu' : 'giu';
            const regex = new RegExp(buildSearchPattern(searchTerm, wholeWord), flags);
            notepadSetText(content.replace(regex, replaceTerm));
            useEditorStore.getState().flushPendingContent();
        } catch {
            // ignore
        }
    };

    const handleClose = () => {
        notepadClearSearchMatches();
        closeFindReplace();
        getNotepadView()?.focus();
    };

    const toggleMode = () => {
        const nextMode = findReplaceMode === 'replace' ? 'find' : 'replace';
        setFindReplaceMode(nextMode);
        if (nextMode === 'replace') {
            requestAnimationFrame(() => {
                replaceInputRef.current?.focus();
                replaceInputRef.current?.select();
            });
        } else {
            findInputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleClose();
        } else if (
            (e.altKey && (e.code === 'KeyF' || e.key === 'ƒ' || e.key.toLowerCase() === 'f')) ||
            (e.ctrlKey && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) ||
            (e.metaKey && (e.code === 'KeyH' || e.key.toLowerCase() === 'h'))
        ) {
            e.preventDefault();
            e.stopPropagation();
            toggleMode();
        } else if (e.altKey && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
            e.preventDefault();
            e.stopPropagation();
            setMatchCase((prev) => !prev);
        } else if (e.altKey && (e.code === 'KeyW' || e.key.toLowerCase() === 'w')) {
            e.preventDefault();
            e.stopPropagation();
            setWholeWord((prev) => !prev);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            navigateMatch(e.shiftKey ? 'prev' : 'next');
            findInputRef.current?.focus();
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
                        title="Match Case (⌥C)"
                        aria-label="Match Case"
                    >
                        Aa
                    </button>
                    <button
                        className={`find-toggle ${wholeWord ? 'active' : ''}`}
                        onClick={() => setWholeWord(!wholeWord)}
                        title="Match Whole Word (⌥W)"
                        aria-label="Match Whole Word"
                    >
                        W
                    </button>
                    <button
                        className="find-btn"
                        onClick={() => {
                            navigateMatch('prev');
                            findInputRef.current?.focus();
                        }}
                        title="Previous (Shift+Enter)"
                    >
                        ↑
                    </button>
                    <button
                        className="find-btn"
                        onClick={() => {
                            navigateMatch('next');
                            findInputRef.current?.focus();
                        }}
                        title="Next (Enter)"
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        className={`find-btn ${findReplaceMode === 'replace' ? 'active' : ''}`}
                        onClick={toggleMode}
                        title={findReplaceMode === 'replace' ? 'Hide Replace (⌥⌘F)' : 'Show Replace (⌥⌘F)'}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                transform: findReplaceMode === 'replace' ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.18s ease',
                            }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    <button className="find-close" onClick={handleClose} title="Close (Esc)">
                        ×
                    </button>
                </div>
            </div>

            {findReplaceMode === 'replace' && (
                <div className="replace-row">
                    <div className="find-input-group">
                        <input
                            ref={replaceInputRef}
                            type="text"
                            className="find-input"
                            placeholder="Replace"
                            value={replaceTerm}
                            onChange={(e) => setReplaceTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleReplace();
                                }
                            }}
                            tabIndex={showFindReplace ? 0 : -1}
                        />
                    </div>
                    <div className="find-actions">
                        <button className="find-btn replace-btn" onClick={handleReplace} title="Replace (Enter)">
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
