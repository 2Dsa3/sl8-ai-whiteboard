// Feedback Collection System for Prompt Optimization
// Collects user feedback on AI responses to improve prompts

class FeedbackCollector {
    constructor(tutorIA) {
        this.tutorIA = tutorIA;
        this.currentInteractionId = null;
        this.setupFeedbackUI();
    }

    setupFeedbackUI() {
        // Add feedback buttons to the output panel
        const outputPanel = document.getElementById('output-panel');
        if (outputPanel) {
            // Create feedback container
            const feedbackContainer = document.createElement('div');
            feedbackContainer.id = 'feedback-container';
            feedbackContainer.className = 'hidden mt-4 p-3 border-t border-gray-200';
            feedbackContainer.innerHTML = `
                <div class="text-sm text-gray-600 mb-2">¿Te ayudó esta respuesta?</div>
                <div class="flex items-center space-x-3">
                    <button id="feedback-helpful" class="feedback-btn bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm transition-colors">
                        👍 Útil
                    </button>
                    <button id="feedback-not-helpful" class="feedback-btn bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm transition-colors">
                        👎 No útil
                    </button>
                    <button id="feedback-confusing" class="feedback-btn bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm transition-colors">
                        🤔 Confuso
                    </button>
                </div>
                <div id="feedback-detail" class="hidden mt-3">
                    <textarea id="feedback-text" placeholder="¿Qué podríamos mejorar?" class="w-full text-sm border border-gray-300 rounded p-2 h-16 resize-none"></textarea>
                    <div class="flex justify-end mt-2">
                        <button id="feedback-submit" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors">
                            Enviar
                        </button>
                    </div>
                </div>
            `;

            // Find the response container and append feedback
            const responseDiv = outputPanel.querySelector('#ai-response');
            if (responseDiv && responseDiv.parentNode) {
                responseDiv.parentNode.appendChild(feedbackContainer);
            }

            this.bindFeedbackEvents();
        }
    }

    bindFeedbackEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'feedback-helpful') {
                this.collectFeedback('helpful', 5);
            } else if (e.target.id === 'feedback-not-helpful') {
                this.collectFeedback('not_helpful', 2);
                this.showDetailForm();
            } else if (e.target.id === 'feedback-confusing') {
                this.collectFeedback('confusing', 2);
                this.showDetailForm();
            } else if (e.target.id === 'feedback-submit') {
                this.submitDetailedFeedback();
            }
        });
    }

    showFeedbackForm(interactionId) {
        this.currentInteractionId = interactionId;
        const feedbackContainer = document.getElementById('feedback-container');
        if (feedbackContainer) {
            feedbackContainer.classList.remove('hidden');
            
            // Auto-hide after 30 seconds if no interaction
            setTimeout(() => {
                if (feedbackContainer && !feedbackContainer.classList.contains('hidden')) {
                    feedbackContainer.classList.add('hidden');
                }
            }, 30000);
        }
    }

    showDetailForm() {
        const detailDiv = document.getElementById('feedback-detail');
        if (detailDiv) {
            detailDiv.classList.remove('hidden');
        }
    }

    collectFeedback(type, rating) {
        if (!this.currentInteractionId) return;

        const feedback = {
            interactionId: this.currentInteractionId,
            type: type,
            rating: rating,
            timestamp: Date.now(),
            wasHelpful: type === 'helpful'
        };

        // Track in analytics
        this.tutorIA.analytics.trackFeedback(
            this.tutorIA.analytics.interactions.length - 1, // Last interaction
            feedback
        );

        // Update experiment tracking
        const outcome = type === 'helpful' ? 'success' : 
                       type === 'confusing' ? 'partial_success' : 'failure';
        
        // Store for golden dataset if positive
        if (type === 'helpful' && this.tutorIA.analytics.interactions.length > 0) {
            const lastInteraction = this.tutorIA.analytics.interactions[this.tutorIA.analytics.interactions.length - 1];
            this.considerForGoldenDataset(lastInteraction, feedback);
        }

        this.hideFeedbackForm();
        this.showThankYou();

        console.log('📊 Feedback collected:', feedback);
    }

    submitDetailedFeedback() {
        const feedbackText = document.getElementById('feedback-text')?.value?.trim();
        if (feedbackText && this.currentInteractionId) {
            // Store detailed feedback
            const detailedFeedback = {
                interactionId: this.currentInteractionId,
                feedback: feedbackText,
                timestamp: Date.now(),
                category: 'detailed_negative'
            };

            // Save to local storage for analysis
            const key = 'detailed_feedback';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push(detailedFeedback);
            localStorage.setItem(key, JSON.stringify(existing));

            console.log('📝 Detailed feedback submitted:', detailedFeedback);
        }

        this.hideFeedbackForm();
        this.showThankYou();
    }

    considerForGoldenDataset(interaction, feedback) {
        // Only consider for golden dataset if highly rated
        if (feedback.rating >= 4 && feedback.wasHelpful) {
            const goldenExample = {
                category: this.mapInteractionTypeToCategory(interaction.type),
                studentQuery: interaction.userQuery,
                aiResponse: interaction.aiResponse,
                hasDrawing: interaction.hasDrawing,
                attemptNumber: 1, // Would need to track this better
                satisfaction: feedback.rating,
                followUpSuccess: true, // Would need to track this
                tags: [interaction.type, 'user_approved'],
                promptUsed: 'current_prompt' // Would store actual prompt
            };

            this.tutorIA.goldenDataset.addGoldenExample(goldenExample);
            console.log('🏆 Added to golden dataset:', goldenExample);
        }
    }

    mapInteractionTypeToCategory(type) {
        const mapping = {
            'stuck': 'encouraging_stuck_student',
            'hint': 'step_by_step_guidance',
            'clarify': 'concept_explanation',
            'next_step': 'step_by_step_guidance',
            'verify': 'error_correction',
            'solution': 'algorithm_walkthrough'
        };
        return mapping[type] || 'concept_explanation';
    }

    hideFeedbackForm() {
        const feedbackContainer = document.getElementById('feedback-container');
        if (feedbackContainer) {
            feedbackContainer.classList.add('hidden');
        }
        
        const detailDiv = document.getElementById('feedback-detail');
        if (detailDiv) {
            detailDiv.classList.add('hidden');
        }
    }

    showThankYou() {
        const feedbackContainer = document.getElementById('feedback-container');
        if (feedbackContainer) {
            feedbackContainer.innerHTML = `
                <div class="text-center text-sm text-green-600 py-2">
                    ¡Gracias por tu feedback! 🙏 Nos ayuda a mejorar.
                </div>
            `;
            feedbackContainer.classList.remove('hidden');
            
            setTimeout(() => {
                feedbackContainer.classList.add('hidden');
            }, 3000);
        }
    }

    // Reset for next interaction
    reset() {
        this.currentInteractionId = null;
        this.hideFeedbackForm();
    }
}

export { FeedbackCollector };
