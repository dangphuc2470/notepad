import { create } from 'zustand';

interface SettingsState {
    theme: 'light' | 'dark' | 'system';
    wordWrap: boolean;
    zoom: number;
    showStatusBar: boolean;
    fontFamily: string;
    fontSize: number;
    showFindReplace: boolean;
    findReplaceMode: 'find' | 'replace';
    reduceMotion: boolean;
    autoSave: boolean;
    whenOpening: 'resume' | 'new_window';

    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setWhenOpening: (value: 'resume' | 'new_window') => void;
    toggleWordWrap: () => void;
    toggleReduceMotion: () => void;
    toggleAutoSave: () => void;
    setZoom: (zoom: number) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    toggleStatusBar: () => void;
    setFontFamily: (font: string) => void;
    setFontSize: (size: number) => void;
    toggleFindReplace: (mode?: 'find' | 'replace') => void;
    closeFindReplace: () => void;
    isSettingsOpen: boolean;
    toggleSettings: () => void;
}

function readStoredTheme(): 'light' | 'dark' | 'system' {
    if (typeof localStorage === 'undefined') return 'system';
    const stored = localStorage.getItem('notepad_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
}

export const useSettingsStore = create<SettingsState>((set) => ({
    theme: readStoredTheme(),
    wordWrap: true,
    zoom: 100,
    showStatusBar: true,
    fontFamily: 'SF Mono, Menlo, Consolas, monospace',
    fontSize: 14,
    showFindReplace: false,
    findReplaceMode: 'find',
    reduceMotion: typeof localStorage !== 'undefined' ? localStorage.getItem('notepad_reducemotion') === 'true' : false,
    autoSave: typeof localStorage !== 'undefined' ? localStorage.getItem('notepad_autosave') === 'true' : false,
    whenOpening: typeof localStorage !== 'undefined' ? ((localStorage.getItem('notepad_when_opening') as 'resume' | 'new_window') || 'resume') : 'resume',
    isSettingsOpen: false,

    setTheme: (theme) => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('notepad_theme', theme);
        }
        set({ theme });
    },
    setWhenOpening: (whenOpening) => {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('notepad_when_opening', whenOpening);
        }
        set({ whenOpening });
    },
    toggleWordWrap: () => set((s) => ({ wordWrap: !s.wordWrap })),
    toggleReduceMotion: () =>
        set((s) => {
            const next = !s.reduceMotion;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('notepad_reducemotion', String(next));
            }
            return { reduceMotion: next };
        }),
    toggleAutoSave: () =>
        set((s) => {
            const next = !s.autoSave;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('notepad_autosave', String(next));
            }
            return { autoSave: next };
        }),
    setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(500, zoom)) }),
    zoomIn: () => set((s) => ({ zoom: Math.min(500, s.zoom + 10) })),
    zoomOut: () => set((s) => ({ zoom: Math.max(50, s.zoom - 10) })),
    resetZoom: () => set({ zoom: 100 }),
    toggleStatusBar: () => set((s) => ({ showStatusBar: !s.showStatusBar })),
    setFontFamily: (fontFamily) => set({ fontFamily }),
    setFontSize: (fontSize) => set({ fontSize: Math.max(8, Math.min(72, fontSize)) }),
    toggleFindReplace: (mode) =>
        set((s) => {
            if (s.showFindReplace && s.findReplaceMode === (mode || 'find')) {
                return { showFindReplace: false };
            }
            return { showFindReplace: true, findReplaceMode: mode || 'find' };
        }),
    closeFindReplace: () => set({ showFindReplace: false }),
    toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
}));
