class Whiteboard {
    constructor(canvasId, cursorId) {
        console.log('🎨 Initializing Whiteboard with canvasId:', canvasId);
        this.canvas = document.getElementById(canvasId);
        console.log('🎨 Canvas element:', this.canvas);
        
        if (!this.canvas) {
            console.error('❌ Canvas element not found!');
            return;
        }
        
        this.context = this.canvas.getContext('2d');
        console.log('🎨 Canvas context:', this.context);
        
        // Configure canvas for optimal stylus/touch performance
        this.canvas.style.touchAction = 'none';
        
        this.eraserCursor = document.getElementById(cursorId);
        this.isDrawing = false;
        this.mode = 'pen'; // 'pen' or 'eraser'
        this.brushSize = 5;
        this.history = [];
        this.historyIndex = -1;

        this.resizeCanvas();
        this.bindEvents();
        this.saveState(); // Guardar el estado inicial en blanco
        
        console.log('✅ Whiteboard initialized successfully');
    }

    bindEvents() {
        console.log('🎯 Binding events to canvas');
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Modern pointer events (supports mouse, pen, touch)
        if ('PointerEvent' in window) {
            console.log('🎯 Using Pointer Events API');
            this.canvas.addEventListener('pointerdown', (e) => this.handlePointerStart(e));
            this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
            this.canvas.addEventListener('pointerup', (e) => this.handlePointerEnd(e));
            this.canvas.addEventListener('pointerleave', (e) => this.handlePointerLeave(e));
            this.canvas.addEventListener('pointerenter', (e) => this.handlePointerEnter(e));
        } else {
            // Fallback to mouse and touch events for older browsers
            console.log('🎯 Using fallback mouse/touch events');
            
            // Mouse events
            this.canvas.addEventListener('mousedown', (e) => this.handlePointerStart(e));
            this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.handlePointerEnd(e));
            this.canvas.addEventListener('mouseleave', (e) => this.handlePointerLeave(e));
            this.canvas.addEventListener('mouseenter', (e) => this.handlePointerEnter(e));
            
            // Touch events for mobile/tablet
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (e.touches.length === 1) {
                    this.handlePointerStart(this.createEventFromTouch(e.touches[0], e));
                }
            });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (e.touches.length === 1) {
                    this.handlePointerMove(this.createEventFromTouch(e.touches[0], e));
                }
            });
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handlePointerEnd(e);
            });
        }
        
        console.log('✅ Events bound successfully');
    }

    // Unified pointer event handlers
    handlePointerStart(e) {
        const coords = this.getEventCoordinates(e);
        const inputType = this.getInputType(e);
        
        console.log(`🎯 ${inputType} down at:`, coords.x, coords.y);
        
        // Prevent default to avoid scrolling on touch devices
        if (e.preventDefault) e.preventDefault();
        
        this.startDrawing(coords);
    }

    handlePointerMove(e) {
        const coords = this.getEventCoordinates(e);
        
        // Update eraser cursor position
        if (this.mode === 'eraser' && this.eraserCursor) {
            this.eraserCursor.style.left = `${e.clientX}px`;
            this.eraserCursor.style.top = `${e.clientY}px`;
        }
        
        this.draw(coords);
    }

    handlePointerEnd(e) {
        const inputType = this.getInputType(e);
        console.log(`🎯 ${inputType} up`);
        
        this.stopDrawing();
    }

    handlePointerLeave(e) {
        this.isDrawing = false;
        if (this.eraserCursor) this.eraserCursor.style.display = 'none';
    }

    handlePointerEnter(e) {
        if (this.mode === 'eraser' && this.eraserCursor) {
            this.eraserCursor.style.display = 'block';
        }
    }

    // Get normalized coordinates from any event type
    getEventCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Handle different event types
        let clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            // Touch event
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            // Mouse or pointer event
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    // Get input type for debugging
    getInputType(e) {
        if (e.pointerType) {
            return e.pointerType; // 'mouse', 'pen', 'touch'
        } else if (e.type && e.type.startsWith('touch')) {
            return 'touch';
        } else {
            return 'mouse';
        }
    }

    // Create normalized event from touch for fallback
    createEventFromTouch(touch, originalEvent) {
        return {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => originalEvent.preventDefault(),
            type: 'touch'
        };
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.redrawHistory(); // Redibujar el contenido al cambiar el tamaño
    }

    setMode(newMode) {
        this.mode = newMode;
        if (this.mode === 'pen') {
            this.canvas.style.cursor = 'crosshair';
            if (this.eraserCursor) this.eraserCursor.style.display = 'none';
        } else if (this.mode === 'eraser') {
            this.canvas.style.cursor = 'none'; // Ocultar cursor por defecto
        }
    }

    setBrushSize(size) {
        this.brushSize = size;
        if (this.mode === 'eraser' && this.eraserCursor) {
            this.eraserCursor.style.width = `${size}px`;
            this.eraserCursor.style.height = `${size}px`;
            this.eraserCursor.style.marginLeft = `-${size/2}px`;
            this.eraserCursor.style.marginTop = `-${size/2}px`;
        }
    }

    startDrawing(coords) {
        console.log('🖱️ Start drawing at:', coords.x, coords.y);
        this.isDrawing = true;
        this.context.beginPath();
        this.context.moveTo(coords.x, coords.y);
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.context.closePath();
            this.saveState(); // Guardar estado después de un trazo
        }
    }

    draw(coords) {
        if (!this.isDrawing) return;

        // Tamaño estático pequeño para el lápiz, tamaño variable para el borrador
        this.context.lineWidth = this.mode === 'pen' ? 2 : this.brushSize;
        this.context.lineCap = 'round';
        this.context.strokeStyle = this.mode === 'pen' ? '#000000' : '#FFFFFF'; // Blanco para borrar
        this.context.globalCompositeOperation = this.mode === 'pen' ? 'source-over' : 'destination-out';

        this.context.lineTo(coords.x, coords.y);
        this.context.stroke();
    }
    
    saveState() {
        // Remove any redo history when a new action is performed
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        if (this.history.length > 20) { // Limitar el historial
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        this.history.push(this.context.getImageData(0, 0, this.canvas.width, this.canvas.height));
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const previousState = this.history[this.historyIndex];
            this.context.putImageData(previousState, 0, 0);
            return true;
        } else if (this.historyIndex === 0) {
            // Go to initial blank state
            this.historyIndex = -1;
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return true;
        }
        return false;
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const nextState = this.history[this.historyIndex];
            this.context.putImageData(nextState, 0, 0);
            return true;
        }
        return false;
    }
    
    clearCanvas(save = true) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.history = []; // Limpiar historial
        this.historyIndex = -1;
        if (save) {
            this.saveState(); // Guardar el estado en blanco como inicial
        }
    }
    
    redrawHistory() {
        if (this.history.length > 0) {
            this.context.putImageData(this.history[this.history.length - 1], 0, 0);
        }
    }

    getCanvasImageData() {
        // Debug: Log canvas state
        console.log('🔍 Canvas capture - Width:', this.canvas.width, 'Height:', this.canvas.height);
        
        // Crear un canvas más pequeño para reducir el tamaño de la imagen
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Reducir el tamaño a 800x600 máximo
        const maxWidth = 800;
        const maxHeight = 600;
        const scale = Math.min(maxWidth / this.canvas.width, maxHeight / this.canvas.height, 1);
        
        tempCanvas.width = this.canvas.width * scale;
        tempCanvas.height = this.canvas.height * scale;
        
        // Establecer fondo blanco antes de dibujar
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Dibujar la imagen escalada
        tempCtx.drawImage(this.canvas, 0, 0, tempCanvas.width, tempCanvas.height);
        
        console.log('🔍 Canvas capture - Temp canvas size:', tempCanvas.width, 'x', tempCanvas.height);
        
        // Convertir a JPEG con calidad reducida para menor tamaño
        return tempCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    }
    
    isEmpty() {
        try {
            // If we have history, check if we have more than just the initial blank state
            if (this.history.length > 1) {
                console.log('🔍 isEmpty() check - Has history:', this.history.length, 'states');
                return false; // We have drawn something if there's more than initial state
            }

            // Check pixel data as fallback
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Check for any non-transparent pixels (alpha > 0) or non-white pixels
            for (let i = 0; i < imageData.data.length; i += 4) {
                const r = imageData.data[i];     // Red
                const g = imageData.data[i + 1]; // Green
                const b = imageData.data[i + 2]; // Blue
                const a = imageData.data[i + 3]; // Alpha
                
                // If we find any pixel that is not transparent and not white, canvas is not empty
                if (a > 0 && (r !== 255 || g !== 255 || b !== 255)) {
                    console.log('🔍 isEmpty() check - Found non-white pixel');
                    return false;
                }
            }
            
            console.log('🔍 isEmpty() check - Canvas is empty (all white/transparent pixels)');
            return true;
        } catch (error) {
            console.error('❌ Error in isEmpty():', error);
            return false; // If error, assume it's not empty to be safe
        }
    }
}

// Export the Whiteboard class for use by main.js
export { Whiteboard };

// No DOMContentLoaded listener here - main.js will handle initialization