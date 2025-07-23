import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { addStroke, removeStroke } from '../store/slices/canvasSlice';
import { addHistoryEntry, undo as undoAction, redo as redoAction } from '../store/slices/historySlice';
import { Stroke } from '../types';

export const useHistory = () => {
  const dispatch = useAppDispatch();
  const historyState = useAppSelector(state => state.history);
  const canvasState = useAppSelector(state => state.canvas);

  const addToHistory = useCallback((action: string, data: any) => {
    dispatch(addHistoryEntry({ action, data }));
  }, [dispatch]);

  const undo = useCallback(() => {
    if (historyState.currentIndex >= 0) {
      const currentEntry = historyState.entries[historyState.currentIndex];
      
      if (currentEntry) {
        // Reverse the action
        switch (currentEntry.action) {
          case 'ADD_STROKE':
            dispatch(removeStroke(currentEntry.data.stroke.id));
            break;
          case 'REMOVE_STROKE':
            dispatch(addStroke(currentEntry.data.stroke));
            break;
        }
      }
      
      dispatch(undoAction());
    }
  }, [dispatch, historyState.currentIndex, historyState.entries]);

  const redo = useCallback(() => {
    if (historyState.currentIndex < historyState.entries.length - 1) {
      dispatch(redoAction());
      
      const nextEntry = historyState.entries[historyState.currentIndex + 1];
      
      if (nextEntry) {
        // Re-apply the action
        switch (nextEntry.action) {
          case 'ADD_STROKE':
            dispatch(addStroke(nextEntry.data.stroke));
            break;
          case 'REMOVE_STROKE':
            dispatch(removeStroke(nextEntry.data.stroke.id));
            break;
        }
      }
    }
  }, [dispatch, historyState.currentIndex, historyState.entries]);

  const canUndo = historyState.currentIndex >= 0 && historyState.entries.length > 0;
  const canRedo = historyState.currentIndex < historyState.entries.length - 1;

  return {
    addToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};