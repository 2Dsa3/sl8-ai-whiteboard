// Analytics and Data Collection for Prompt Optimization
// Track user interactions to optimize AI responses

class PromptAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.interactions = [];
        this.startTime = Date.now();
    }

    generateSessionId() {
        const randHex = (bytes = 8) => {
            if (globalThis.crypto && globalThis.crypto.getRandomValues) {
                const arr = new Uint8Array(bytes);
                globalThis.crypto.getRandomValues(arr);
                return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
            }
            const now = Date.now().toString(16);
            this._sidCounter = (this._sidCounter || 0) + 1;
            return (now + this._sidCounter.toString(16)).slice(-bytes * 2).padStart(bytes * 2, '0');
        };
        return Date.now().toString(36) + randHex(8);
    }

    // Track user queries and AI responses
    trackInteraction(data) {
        const interaction = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            type: data.type, // 'question', 'hint', 'explanation', 'correction'
            userQuery: data.userQuery,
            aiResponse: data.aiResponse,
            responseTime: data.responseTime,
            userAction: data.userAction, // 'helpful', 'not_helpful', 'follow_up', 'abandoned'
            context: {
                hasDrawing: data.hasDrawing,
                drawingComplexity: data.drawingComplexity,
                previousInteractions: this.interactions.length
            }
        };

        this.interactions.push(interaction);
        this.saveToLocalStorage();
        
        // Log for development
        console.log('📊 Interaction tracked:', interaction);
    }

    // Track user feedback on responses
    trackFeedback(interactionIndex, feedback) {
        if (this.interactions[interactionIndex]) {
            this.interactions[interactionIndex].feedback = {
                rating: feedback.rating, // 1-5 scale
                wasHelpful: feedback.wasHelpful,
                reason: feedback.reason,
                timestamp: Date.now()
            };
            this.saveToLocalStorage();
        }
    }

    // Track user engagement patterns
    trackEngagement(action) {
        const engagement = {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            action: action, // 'canvas_draw', 'canvas_erase', 'submit_exercise', 'clear_all', 'exit'
            sessionDuration: Date.now() - this.startTime,
            totalInteractions: this.interactions.length
        };

        console.log('📈 Engagement tracked:', engagement);
        this.saveEngagementToLocalStorage(engagement);
    }

    saveToLocalStorage() {
        localStorage.setItem(`prompt_analytics_${this.sessionId}`, JSON.stringify(this.interactions));
    }

    saveEngagementToLocalStorage(engagement) {
        const key = `engagement_analytics`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push(engagement);
        localStorage.setItem(key, JSON.stringify(existing));
    }

    // Export data for analysis
    exportData() {
        return {
            sessionId: this.sessionId,
            startTime: this.startTime,
            endTime: Date.now(),
            totalDuration: Date.now() - this.startTime,
            interactions: this.interactions,
            engagement: JSON.parse(localStorage.getItem('engagement_analytics') || '[]')
        };
    }

    // Get insights for prompt optimization
    getInsights() {
        const totalInteractions = this.interactions.length;
        const helpfulResponses = this.interactions.filter(i => i.feedback?.wasHelpful).length;
        const avgResponseTime = this.interactions.reduce((sum, i) => sum + (i.responseTime || 0), 0) / totalInteractions;

        return {
            totalInteractions,
            helpfulnessRate: helpfulResponses / totalInteractions,
            avgResponseTime,
            commonQuestionTypes: this.getCommonQuestionTypes(),
            dropOffPoints: this.getDropOffPoints()
        };
    }

    getCommonQuestionTypes() {
        const types = {};
        this.interactions.forEach(i => {
            types[i.type] = (types[i.type] || 0) + 1;
        });
        return Object.entries(types).sort(([,a], [,b]) => b - a);
    }

    getDropOffPoints() {
        // Identify where users tend to stop engaging
        const dropOffs = [];
        for (let i = 0; i < this.interactions.length - 1; i++) {
            const timeDiff = this.interactions[i + 1].timestamp - this.interactions[i].timestamp;
            if (timeDiff > 60000) { // More than 1 minute gap
                dropOffs.push({
                    afterInteraction: i,
                    gap: timeDiff,
                    previousResponseType: this.interactions[i].type
                });
            }
        }
        return dropOffs;
    }
}

export { PromptAnalytics };
