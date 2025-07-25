import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Path, G, Circle, Text as SvgText, Image as SvgImage } from 'react-native-svg';
import { useAppDispatch, useAppSelector } from '../store';
import { setZoom, setPanOffset, addStroke, removeStroke, addTextElement, addImageElement } from '../store/slices/canvasSlice';
import { useHistory } from '../hooks/useHistory';
import { PenTool } from '../tools/PenTool';
import { PencilTool } from '../tools/PencilTool';
import { HighlighterTool } from '../tools/HighlighterTool';
import { EraserTool } from '../tools/EraserTool';
import { TextTool } from '../tools/TextTool';
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
  const [isTyping, setIsTyping] = useState(false);
  const [typingPosition, setTypingPosition] = useState<Point | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [lastCursorPosition, setLastCursorPosition] = useState<Point>({ x: width / 2, y: height / 2, timestamp: Date.now() });
  const currentTool = useRef<PenTool | PencilTool | HighlighterTool | EraserTool | TextTool>(new PenTool(toolsState.currentTool.settings));
  const lastPinchDistance = useRef<number>(0);
  const initialPanOffset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<View>(null);

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
      case 'text':
        currentTool.current = new TextTool(settings);
        setShowEraserCursor(false);
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

  // Generate unique ID
  const generateId = (prefix: string = 'id'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Handle paste events (Ctrl+V / Cmd+V)
  const handlePaste = async (event: ClipboardEvent) => {
    event.preventDefault();

    const clipboardItems = event.clipboardData?.items;
    if (!clipboardItems) return;

    // Get paste position (center of visible area or last cursor position)
    const pastePosition: Point = {
      x: (width / 2 - canvasState.panOffset.x) / canvasState.zoom,
      y: (height / 2 - canvasState.panOffset.y) / canvasState.zoom,
      timestamp: Date.now(),
    };

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];

      if (item.type.startsWith('image/')) {
        // Handle image paste
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const imageUri = e.target?.result as string;
            const imageElement = {
              id: generateId('image'),
              layerId: 'default-layer',
              uri: imageUri,
              position: pastePosition,
              size: { width: 200, height: 150 }, // Default size, can be adjusted
              rotation: 0,
              timestamp: Date.now(),
              bounds: {
                x: pastePosition.x,
                y: pastePosition.y,
                width: 200,
                height: 150,
              },
            };

            dispatch(addImageElement(imageElement));
            addToHistory('ADD_IMAGE', { imageElement });
          };
          reader.readAsDataURL(file);
        }
      } else if (item.type === 'text/plain') {
        // Handle text paste
        item.getAsString((text) => {
          const textElement = {
            id: generateId('text'),
            layerId: 'default-layer',
            content: text,
            position: pastePosition,
            style: {
              fontSize: 16,
              fontWeight: 'normal' as const,
              fontStyle: 'normal' as const,
              color: '#000000',
            },
            timestamp: Date.now(),
            bounds: {
              x: pastePosition.x,
              y: pastePosition.y,
              width: text.length * 10, // Approximate width
              height: 20, // Approximate height
            },
          };

          dispatch(addTextElement(textElement));
          addToHistory('ADD_TEXT', { textElement });
        });
      }
    }
  };

  // Handle typing directly on canvas
  const handleTyping = (text: string, position: Point) => {
    if (editingTextId) {
      // Update existing text
      const existingText = canvasState.textElements[editingTextId];
      if (existingText) {
        const updatedText = {
          ...existingText,
          content: text,
          bounds: {
            ...existingText.bounds,
            width: text.length * 10,
          },
        };
        dispatch(addTextElement(updatedText));
      }
    } else {
      // Create new text
      const textElement = {
        id: generateId('text'),
        layerId: 'default-layer',
        content: text,
        position: position,
        style: {
          fontSize: 18,
          fontWeight: 'normal' as const,
          fontStyle: 'normal' as const,
          color: toolsState.currentTool.settings.color,
        },
        timestamp: Date.now(),
        bounds: {
          x: position.x,
          y: position.y,
          width: text.length * 12,
          height: 24,
        },
      };
      
      dispatch(addTextElement(textElement));
      addToHistory('ADD_TEXT', { textElement });
    }
  };

  // Add paste event listener and keyboard handling
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Handle typing when in text mode or typing mode
      if (isTyping || toolsState.currentTool.type === 'text') {
        if (event.key === 'Enter') {
          // Finish typing
          if (currentText.trim() && typingPosition) {
            handleTyping(currentText, typingPosition);
          }
          setIsTyping(false);
          setCurrentText('');
          setTypingPosition(null);
          setEditingTextId(null);
          return;
        } else if (event.key === 'Escape') {
          // Cancel typing
          setIsTyping(false);
          setCurrentText('');
          setTypingPosition(null);
          setEditingTextId(null);
          return;
        } else if (event.key === 'Backspace') {
          // Handle backspace
          setCurrentText(prev => prev.slice(0, -1));
          return;
        } else if (event.key.length === 1) {
          // Add character to current text
          setCurrentText(prev => prev + event.key);
          return;
        }
      }

      // Check for Ctrl+V (Windows/Linux) or Cmd+V (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();

        try {
          // Use modern Clipboard API
          const clipboardItems = await navigator.clipboard.read();

          // Get paste position (center of visible area)
          const pastePosition: Point = {
            x: (width / 2 - canvasState.panOffset.x) / canvasState.zoom,
            y: (height / 2 - canvasState.panOffset.y) / canvasState.zoom,
            timestamp: Date.now(),
          };

          for (const clipboardItem of clipboardItems) {
            // Handle images
            for (const type of clipboardItem.types) {
              if (type.startsWith('image/')) {
                const blob = await clipboardItem.getType(type);
                const reader = new FileReader();
                reader.onload = (e) => {
                  const imageUri = e.target?.result as string;
                  const imageElement = {
                    id: generateId('image'),
                    layerId: 'default-layer',
                    uri: imageUri,
                    position: pastePosition,
                    size: { width: 200, height: 150 },
                    rotation: 0,
                    timestamp: Date.now(),
                    bounds: {
                      x: pastePosition.x,
                      y: pastePosition.y,
                      width: 200,
                      height: 150,
                    },
                  };

                  dispatch(addImageElement(imageElement));
                  addToHistory('ADD_IMAGE', { imageElement });
                };
                reader.readAsDataURL(blob);
                return; // Exit after handling first image
              }
            }
          }

          // Handle text if no image was found
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              const textElement = {
                id: generateId('text'),
                layerId: 'default-layer',
                content: text,
                position: pastePosition,
                style: {
                  fontSize: 16,
                  fontWeight: 'normal' as const,
                  fontStyle: 'normal' as const,
                  color: '#000000',
                },
                timestamp: Date.now(),
                bounds: {
                  x: pastePosition.x,
                  y: pastePosition.y,
                  width: text.length * 10,
                  height: 20,
                },
              };

              dispatch(addTextElement(textElement));
              addToHistory('ADD_TEXT', { textElement });
            }
          } catch (textError) {
            console.log('No text in clipboard or permission denied');
          }
        } catch (error) {
          console.log('Clipboard access denied or not supported:', error);
          // Fallback to the old paste event method
          document.addEventListener('paste', handlePaste as any, { once: true });
        }
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste as any);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste as any);
    };
  }, [canvasState.zoom, canvasState.panOffset, width, height]);

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
      } else if (toolsState.currentTool.type === 'text') {
        // Start typing at clicked position
        setIsTyping(true);
        setTypingPosition(point);
        setCurrentText('');
        setEditingTextId(null);
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

  const renderTextElements = () => {
    return Object.values(canvasState.textElements).map((textElement) => (
      <SvgText
        key={textElement.id}
        x={textElement.position.x}
        y={textElement.position.y}
        fontSize={textElement.style.fontSize}
        fontWeight={textElement.style.fontWeight}
        fontStyle={textElement.style.fontStyle}
        fill={textElement.style.color}
        textAnchor="start"
        alignmentBaseline="hanging"
      >
        {textElement.content}
      </SvgText>
    ));
  };

  const renderImageElements = () => {
    return Object.values(canvasState.imageElements).map((imageElement) => (
      <SvgImage
        key={imageElement.id}
        x={imageElement.position.x}
        y={imageElement.position.y}
        width={imageElement.size.width}
        height={imageElement.size.height}
        href={imageElement.uri}
        preserveAspectRatio="xMidYMid meet"
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

          {/* Render text elements */}
          {renderTextElements()}

          {/* Render image elements */}
          {renderImageElements()}

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

          {/* Render text being typed */}
          {isTyping && typingPosition && (
            <>
              {/* Text cursor/indicator */}
              <Circle
                cx={typingPosition.x}
                cy={typingPosition.y}
                r={2}
                fill={toolsState.currentTool.settings.color}
                opacity={0.8}
              />
              {/* Current text being typed */}
              {currentText && (
                <SvgText
                  x={typingPosition.x}
                  y={typingPosition.y}
                  fontSize={18}
                  fontWeight="normal"
                  fontStyle="normal"
                  fill={toolsState.currentTool.settings.color}
                  textAnchor="start"
                  alignmentBaseline="hanging"
                  opacity={0.8}
                >
                  {currentText}
                </SvgText>
              )}
            </>
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