import React, { useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useAppDispatch, useAppSelector } from '../store';
import { setZoom, setPanOffset, addStroke } from '../store/slices/canvasSlice';
import { useHistory } from '../hooks/useHistory';
import { PenTool } from '../tools/PenTool';
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
  const currentTool = useRef<PenTool>(new PenTool(toolsState.currentTool.settings));
  const lastPinchDistance = useRef<number>(0);
  const initialPanOffset = useRef({ x: 0, y: 0 });

  // Update tool settings when they change in Redux
  React.useEffect(() => {
    currentTool.current.updateSettings(toolsState.currentTool.settings);
  }, [toolsState.currentTool.settings]);

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

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt: GestureResponderEvent) => {
      const { nativeEvent } = evt;
      
      if (nativeEvent.touches.length === 2) {
        // Two finger gesture - prepare for zoom/pan
        lastPinchDistance.current = getDistance(nativeEvent.touches);
        initialPanOffset.current = { ...canvasState.panOffset };
        return;
      }

      // Single finger - start drawing
      const touch = nativeEvent.touches[0];
      const point = getCanvasPoint(touch);

      setIsDrawing(true);
      currentTool.current.onStart(point, 'default-layer');
      
      const stroke = currentTool.current.getCurrentStroke();
      if (stroke) {
        setCurrentPath(convertPointsToPath(stroke.points));
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

      if (!isDrawing) return;

      // Single finger - continue drawing
      const touch = nativeEvent.touches[0];
      const point = getCanvasPoint(touch);

      currentTool.current.onMove(point);
      
      const stroke = currentTool.current.getCurrentStroke();
      if (stroke) {
        setCurrentPath(convertPointsToPath(stroke.points));
      }
    },

    onPanResponderRelease: (evt: GestureResponderEvent) => {
      const { nativeEvent } = evt;
      
      if (nativeEvent.touches.length === 0 && isDrawing) {
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

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
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
          {isDrawing && currentPath && (
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