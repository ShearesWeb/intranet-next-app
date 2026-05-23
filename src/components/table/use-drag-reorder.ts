"use client";

import * as React from "react";

interface DragReorderState {
  draggedIndex: number | null;
  dragOverIndex: number | null;
  isDropPending: boolean;
  dropAnimation: { index: number; direction: "up" | "down" } | null;
}

interface DragReorderHandlers {
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragLeave: () => void;
  handleDragEnd: () => void;
  handleDrop: (e: React.DragEvent, dropIndex: number) => void;
}

interface UseDragReorderResult extends DragReorderState, DragReorderHandlers {
  getDragHandlers: (rowIndex: number) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDragEnd: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  getRowShift: (rowIndex: number) => "down" | "up" | null;
}

const DROP_COMMIT_DELAY_MS = 140;
const DROP_ANIMATION_DURATION_MS = 380;

export function useDragReorder<TData>(
  data: TData[],
  onReorder?: (newData: TData[]) => void,
): UseDragReorderResult {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [isDropPending, setIsDropPending] = React.useState(false);
  const [dropAnimation, setDropAnimation] = React.useState<{
    index: number;
    direction: "up" | "down";
  } | null>(null);
  const commitTimerRef = React.useRef<number | null>(null);
  const dropAnimationTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }
      if (dropAnimationTimerRef.current !== null) {
        window.clearTimeout(dropAnimationTimerRef.current);
      }
    };
  }, []);

  const handleDragStart = React.useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));

    const sourceRow = e.currentTarget as HTMLTableRowElement;
    const dragPreview = sourceRow.cloneNode(true) as HTMLTableRowElement;
    dragPreview.style.position = "absolute";
    dragPreview.style.top = "-9999px";
    dragPreview.style.left = "-9999px";
    dragPreview.style.width = `${sourceRow.getBoundingClientRect().width}px`;
    dragPreview.style.background = "hsl(var(--background))";
    dragPreview.style.opacity = "0.95";
    dragPreview.style.transform = "scale(1.03)";
    dragPreview.style.boxShadow = "0 16px 38px rgba(234, 88, 12, 0.25)";
    dragPreview.style.border = "1px solid hsl(var(--primary) / 0.35)";
    dragPreview.style.borderRadius = "10px";
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 24, 24);

    requestAnimationFrame(() => {
      document.body.removeChild(dragPreview);
    });
  }, []);

  const handleDragOver = React.useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex],
  );

  const handleDragLeave = React.useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDragEnd = React.useCallback(() => {
    if (isDropPending) return;
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [isDropPending]);

  const handleDrop = React.useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();

      if (draggedIndex === null || draggedIndex === dropIndex) {
        setIsDropPending(false);
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }

      const newData = [...data];
      const [draggedItem] = newData.splice(draggedIndex, 1);
      newData.splice(dropIndex, 0, draggedItem);

      const direction = dropIndex > draggedIndex ? "down" : "up";
      setIsDropPending(true);
      setDragOverIndex(dropIndex);

      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }
      commitTimerRef.current = window.setTimeout(() => {
        onReorder?.(newData);
        setDropAnimation({ index: dropIndex, direction });
        setDraggedIndex(null);
        setDragOverIndex(null);
        setIsDropPending(false);

        if (dropAnimationTimerRef.current !== null) {
          window.clearTimeout(dropAnimationTimerRef.current);
        }
        dropAnimationTimerRef.current = window.setTimeout(() => {
          setDropAnimation(null);
        }, DROP_ANIMATION_DURATION_MS);
      }, DROP_COMMIT_DELAY_MS);
    },
    [data, draggedIndex, onReorder],
  );

  const getDragHandlers = React.useCallback(
    (rowIndex: number) => ({
      draggable: !isDropPending,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, rowIndex),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, rowIndex),
      onDragLeave: handleDragLeave,
      onDragEnd: handleDragEnd,
      onDrop: (e: React.DragEvent) => handleDrop(e, rowIndex),
    }),
    [isDropPending, handleDragStart, handleDragOver, handleDragLeave, handleDragEnd, handleDrop],
  );

  const getRowShift = React.useCallback(
    (rowIndex: number): "down" | "up" | null => {
      if (draggedIndex === null || dragOverIndex === null) return null;
      if (
        draggedIndex < dragOverIndex &&
        rowIndex > draggedIndex &&
        rowIndex <= dragOverIndex
      ) {
        return "down";
      }
      if (
        draggedIndex > dragOverIndex &&
        rowIndex < draggedIndex &&
        rowIndex >= dragOverIndex
      ) {
        return "up";
      }
      return null;
    },
    [draggedIndex, dragOverIndex],
  );

  return {
    draggedIndex,
    dragOverIndex,
    isDropPending,
    dropAnimation,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop,
    getDragHandlers,
    getRowShift,
  };
}
