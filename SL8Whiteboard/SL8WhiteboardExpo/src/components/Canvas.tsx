import React, { useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { useAppDispatch, useAppSelector } from '../store';
import { setZoom, setPanOffset, addStroke, removeStroke } from '../store/slices/canvasSlice';
import { useHistory } from '../hooks/useHistory';
import { PenTool } from '../tools/PenTool';
import { PencilTool } from '../tools/PencilTool';
import { HighlighterTool } from '../tools/HighlighterTool';
import { EraserTool } from '../tools/EraserTool';
import { Point, Stroke } from '../types';

interface CanvasProps {
  width?: number;
  height?: number;
}

const Canvas: React.FC<CanvasProps> = ({ 
  width = Dimensions.get('window').width, 
  height = Dimensions.get('window').height 
}) => {
  const dispatch = useAppDispatch();
  const canvasState = useAppSelector(state => state.canvas);
  const toolsState = useAppSelector(state => state.tools);
  const { addToHistory } = useHistory();
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isErasing, setIsErasing] = useState(false);
  const [eraserPosition, setEraserPosition] = useState<Point | null>(null);
  const [showEraserCursor, setShowEraserCursor] = useState(false);
  const currentTool = useRef<PenTool | PencilTool | HighlighterTool | EraserTool>(new PenTool(toolsState.currentTool.settings));
  const lastPinchDistance = useRef<number>(0);
  const initialPanOffset = useRef({ x: 0, y: 0 });

  // Create the appropriate tool based on the selected tool type
  React.useEffect(() => {
    const settings = toolsState.currentTool.settings;
    
    switch (toolsState.currentTool.type) {
      case 'pen':
        currentTool.current = new PenTool(settings);
        setShowEraserCursor(false);
        break;
      case 'pencil':
        currentTool.current = new PencilTool(settings);
        setShowEraserCursor(false);
        break;
      case 'highlighter':
        currentTool.current = new HighlighterTool(settings);
        setShowEraserCursor(false);
        break;
      case 'eraser':
        currentTool.current = new EraserTool(settings);
        setShowEraserCursor(true);
        break;
      default:
        currentTool.current = new PenTool(settings);
        setShowEraserCursor(false);
    }
  }, [toolsState.currentTool.type, toolsState.currentTool.settings]);

  const convertPointsToPath = (points: Point[]): string => {
    if (points.length === 0) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    if (points.length === 1) {
      // Single point - draw a small circle
      path += ` L ${points[0].x + 0.1} ${points[0].y}`;
    } else {
      // Multiple points - create smooth curve
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        path += ` L ${point.x} ${point.y}`;
      }
    }
    
    return path;
  };

  const getDistance = (touches: any[]): number => {
    if (touches.length < 2) return 0;
    const [touch1, touch2] = touches;
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCanvasPoint = (touch: any): Point => {
    // Use locationX/Y which are relative to the component, not the screen
    const screenX = touch.locationX !== undefined ? touch.locationX : touch.pageX;
    const screenY = touch.locationY !== undefined ? touch.locationY : touch.pageY;
    
    // Convert screen coordinates to canvas coordinates accounting for zoom and pan
    return {
      x: screenX / canvasState.zoom - canvasState.panOffset.x / canvasState.zoom,
      y: screenY / canvasState.zoom - canvasState.panOffset.y / canvasState.zoom,
      timestamp: Date.now(),
    };
  };

  // Check if a point is within eraser radius of any stroke point
  const checkStrokeCollision = (eraserPoint: Point, stroke: Stroke, eraserRadius: number): boolean => {
    return stroke.points.some(strokePoint => {
      const dx = strokePoint.x - eraserPoint.x;
      const dy = strokePoint.y - eraserPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= eraserRadius;
    });
  };

  // Split a stroke at eraser points with better precision
  const splitStroke = (stroke: Stroke, eraserPoint: Point, eraserRadius: number): Stroke[] => {
    const newStrokes: Stroke[] = [];
    let currentSegment: Point[] = [];
    let isInEraserZone = false;
    
    for (let i = 0; i < stroke.points.length; i++) {
      const point = stroke.points[i];
      const dx = point.x - eraserPoint.x;
      const dy = point.y - eraserPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const pointInEraser = distance <= eraserRadius;
      
      if (pointInEraser && !isInEraserZone) {
        // Entering eraser zone - end current segment
        if (currentSegment.length >= 2) {
          const newStroke: Stroke = {
            ...stroke,
            id: `${stroke.id}-split-${newStrokes.length}`,
            points: [...currentSegment],
            bounds: calculateBoundingBox(currentSegment),
            timestamp: Date.now(),
          };
          newStrokes.push(newStroke);
        }
        currentSegment = [];
        isInEraserZone = true;
      } else if (!pointInEraser && isInEraserZone) {
        // Exiting eraser zone - start new segment
        currentSegment = [point];
        isInEraserZone = false;
      } else if (!pointInEraser) {
        // Outside eraser zone - add to current segment
        currentSegment.push(point);
      }
      // If pointInEraser && isInEraserZone, we skip the point (it gets erased)
    }
    
    // Add final segment if it has enough points
    if (currentSegment.length >= 2) {
      const newStroke: Stroke = {
        ...stroke,
        id: `${stroke.id}-split-${newStrokes.length}`,
        points: [...currentSegment],
        bounds: calculateBoundingBox(currentSegment),
        timestamp: Date.now(),
      };
      newStrokes.push(newStroke);
    }
    
    return newStrokes;
  };

  // Calculate bounding box for points
  const calculateBoundingBox = (points: Point[]) => {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  // Keep track of processed strokes to avoid duplicate processing
  const processedStrokes = useRef<Set<string>>(new Set());

  // Handle erasing logic - split strokes instead of removing them completely
  const handleErasing = (point: Point) => {
    if (toolsState.currentTool.type !== 'eraser') return;
    
    const eraserRadius = toolsState.currentTool.settings.width / 2;
    const strokesToProcess: Stroke[] = [];
    
    // Find strokes that collide with eraser and haven't been processed yet
    Object.values(canvasState.strokes).forEach((stroke: Stroke) => {
      if (checkStrokeCollision(point, stroke, eraserRadius) && !processedStrokes.current.has(stroke.id)) {
        strokesToProcess.push(stroke);
        processedStrokes.current.add(stroke.id);
      }
    });
    
    // Process each colliding stroke
    strokesToProcess.forEach(originalStroke => {
      // Remove original stroke
      dispatch(removeStroke(originalStroke.id));
      addToHistory('REMOVE_STROKE', { stroke: originalStroke });
      
      // Split the stroke and add the segments
      const splitStrokes = splitStroke(originalStroke, point, eraserRadius);
      splitStrokes.forEach(newStroke => {
        dispatch(addStroke(newStroke));
        addToHistory('ADD_STROKE', { stroke: newStroke });
      });
    });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onShouldBlockNativeResponder: () => false,

    onPanResponderGrant: (evt: GestureResponderEvent) => {
      const { nativeEvent } = evt;
      
      if (nativeEvent.touches.length === 2) {
        // Two finger gesture - prepare for zoom/pan
        lastPinchDistance.current = getDistance(nativeEvent.touches);
        initialPanOffset.current = { ...canvasState.panOffset };
        return;
      }

      // Single finger - start drawing or erasing
      const touch = nativeEvent.touches[0];
      const point = getCanvasPoint(touch);

      if (toolsState.currentTool.type === 'eraser') {
        setIsErasing(true);
        setEraserPosition(point);
        handleErasing(point);
      } else {
        setIsDrawing(true);
        currentTool.current.onStart(point, 'default-layer');
        
        const stroke = currentTool.current.getCurrentStroke();
        if (stroke) {
          setCurrentPath(convertPointsToPath(stroke.points));
        }
      }
    },

    onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const { nativeEvent } = evt;
      
      if (nativeEvent.touches.length === 2) {
        // Two finger gesture - zoom and pan
        const currentDistance = getDistance(nativeEvent.touches);
        
        if (lastPinchDistance.current > 0) {
          const scale = currentDistance / lastPinchDistance.current;
          const newZoom = Math.max(0.25, Math.min(4.0, canvasState.zoom * scale));
          dispatch(setZoom(newZoom));
        }
        
        // Pan with two fingers
        const newPanOffset = {
          x: initialPanOffset.current.x + gestureState.dx,
          y: initialPanOffset.current.y + gestureState.dy,
        };
        dispatch(setPanOffset(newPanOffset));
        
        lastPinchDistance.current = currentDistance;
        return;
      }

      // Single finger - continue drawing or erasing
      const touch = nativeEvent.touches[0];
      const point = getCanvasPoint(touch);

      if (toolsState.currentTool.type === 'eraser') {
        // Update eraser position and continue erasing if active
        setEraserPosition(point);
        if (isErasing) {
          handleErasing(point);
        }
      } else if (isDrawing) {
        // Continue drawing
        currentTool.current.onMove(point);
        
        const stroke = currentTool.current.getCurrentStroke();
        if (stroke) {
          setCurrentPath(convertPointsToPath(stroke.points));
        }
      }
    },

    onPanResponderRelease: (evt: GestureResponderEvent) => {
      const { nativeEvent } = evt;
      
      if (nativeEvent.touches.length === 0) {
        if (isDrawing) {
          // End drawing
          const touch = nativeEvent.changedTouches[0];
          const point = getCanvasPoint(touch);

          const finalStroke = currentTool.current.onEnd(point);
          if (finalStroke) {
            dispatch(addStroke(finalStroke));
            addToHistory('ADD_STROKE', { stroke: finalStroke });
          }

          setIsDrawing(false);
          setCurrentPath('');
        } else if (isErasing) {
          // End erasing
          setIsErasing(false);
          // Clear processed strokes so they can be erased again
          processedStrokes.current.clear();
        }
      }
      
      lastPinchDistance.current = 0;
    },
  });

  const renderStrokes = () => {
    return Object.values(canvasState.strokes).map((stroke: Stroke) => (
      <Path
        key={stroke.id}
        d={convertPointsToPath(stroke.points)}
        stroke={stroke.style.color}
        strokeWidth={stroke.style.width}
        strokeOpacity={stroke.style.opacity}
        strokeLinecap={stroke.style.lineCap}
        strokeLinejoin={stroke.style.lineJoin}
        fill="none"
      />
    ));
  };

  // Handle mouse move for web (to show eraser cursor)
  const handleMouseMove = (event: any) => {
    if (toolsState.currentTool.type === 'eraser' && !isErasing) {
      const rect = event.currentTarget.getBoundingClientRect();
      const point: Point = {
        x: (event.clientX - rect.left) / canvasState.zoom - canvasState.panOffset.x / canvasState.zoom,
        y: (event.clientY - rect.top) / canvasState.zoom - canvasState.panOffset.y / canvasState.zoom,
        timestamp: Date.now(),
      };
      setEraserPosition(point);
    }
  };

  return (
    <View 
      style={styles.container} 
      {...panResponder.panHandlers}
      // @ts-ignore - onMouseMove is web-only
      onMouseMove={handleMouseMove}
    >
      <Svg
        width={width}
        height={height}
        style={styles.svg}
      >
        <G
          scale={canvasState.zoom}
          translateX={canvasState.panOffset.x / canvasState.zoom}
          translateY={canvasState.panOffset.y / canvasState.zoom}
        >
          {/* Render existing strokes */}
          {renderStrokes()}
          
          {/* Render current stroke being drawn */}
          {isDrawing && currentPath && toolsState.currentTool.type !== 'eraser' && (
            <Path
              d={currentPath}
              stroke={toolsState.currentTool.settings.color}
              strokeWidth={toolsState.currentTool.settings.width}
              strokeOpacity={toolsState.currentTool.settings.opacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}

          {/* Render eraser cursor */}
          {showEraserCursor && eraserPosition && (
            <Circle
              cx={eraserPosition.x}
              cy={eraserPosition.y}
              r={toolsState.currentTool.settings.width / 2}
              fill="white"
              stroke="black"
              strokeWidth={2}
              opacity={0.8}
            />
          )}
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  svg: {
    flex: 1,
  },
});

export default Canvas;