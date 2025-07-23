// Prompt A/B Testing System
// Test different prompt strategies to optimize learning outcomes

class PromptExperiments {
    constructor() {
        this.experiments = {
            // Socratic vs Direct teaching
            teachingStyle: {
                variants: ['socratic', 'direct', 'hybrid'],
                weights: [0.4, 0.3, 0.3], // Traffic split
                active: true
            },
            
            // Response length optimization  
            responseLength: {
                variants: ['concise', 'detailed', 'adaptive'],
                weights: [0.33, 0.33, 0.34],
                active: true
            },

            // Hint timing strategy
            hintStrategy: {
                variants: ['immediate', 'delayed', 'progressive'],
                weights: [0.33, 0.33, 0.34],
                active: false // Not running yet
            }
        };

        this.userVariant = this.assignUserToVariants();
        console.log('🧪 User assigned to variants:', this.userVariant);
    }

    assignUserToVariants() {
        const userId = localStorage.getItem('user_id') || this.generateUserId();
        localStorage.setItem('user_id', userId);
        
        const variants = {};
        
        Object.keys(this.experiments).forEach(experimentName => {
            const experiment = this.experiments[experimentName];
            if (experiment.active) {
                variants[experimentName] = this.selectVariant(userId, experiment);
            }
        });

        return variants;
    }

    generateUserId() {
        return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    selectVariant(userId, experiment) {
        // Deterministic assignment based on user ID
        const hash = this.hashString(userId) % 100;
        let cumulative = 0;
        
        for (let i = 0; i < experiment.variants.length; i++) {
            cumulative += experiment.weights[i] * 100;
            if (hash < cumulative) {
                return experiment.variants[i];
            }
        }
        
        return experiment.variants[0]; // Fallback
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Get the appropriate prompt based on user's variant
    getPrompt(basePrompt, context) {
        const teachingStyle = this.userVariant.teachingStyle;
        const responseLength = this.userVariant.responseLength;

        return this.buildPrompt(basePrompt, teachingStyle, responseLength, context);
    }

    buildPrompt(basePrompt, teachingStyle, responseLength, context) {
        let prompt = basePrompt;

        // Teaching style modifications
        const stylePrompts = {
            socratic: `
                TEACHING APPROACH: Use the Socratic method. Ask probing questions that guide the student to discover the answer themselves. Never give direct solutions.
                
                Example flow:
                - "What do you think might happen if...?"
                - "Why do you think that occurs?"
                - "Can you think of a similar situation?"
                - "What would you try next?"
            `,
            
            direct: `
                TEACHING APPROACH: Provide clear, direct explanations and concrete examples. Be instructional and specific.
                
                Structure your response:
                1. Clear explanation of the concept
                2. Step-by-step solution approach
                3. Concrete example
                4. Next recommended action
            `,
            
            hybrid: `
                TEACHING APPROACH: Balance guidance with discovery. Start with a guiding question, then provide explanation if needed.
                
                Flow:
                1. Start with 1-2 guiding questions
                2. If student struggles, provide more direct guidance
                3. Always end with a question to check understanding
            `
        };

        // Response length modifications
        const lengthPrompts = {
            concise: `
                RESPONSE LENGTH: Keep responses under 100 words. Be precise and to the point.
                Focus only on the most essential information.
            `,
            
            detailed: `
                RESPONSE LENGTH: Provide comprehensive explanations (150-250 words).
                Include context, examples, and multiple perspectives where helpful.
            `,
            
            adaptive: `
                RESPONSE LENGTH: Adapt based on complexity:
                - Simple concepts: 50-100 words
                - Complex concepts: 150-200 words
                - Multi-step problems: Break into smaller parts
            `
        };

        prompt += stylePrompts[teachingStyle] + lengthPrompts[responseLength];

        // Add context-specific modifiers
        if (context.hasDrawing) {
            prompt += `\n\nThe student has provided a drawing. Reference their visual work specifically and build upon what they've drawn.`;
        }

        if (context.attemptNumber > 1) {
            prompt += `\n\nThis is attempt #${context.attemptNumber}. The student may be struggling, so adjust your approach to be more supportive.`;
        }

        return prompt;
    }

    // Track experiment results
    trackResult(interaction, outcome) {
        const result = {
            userId: localStorage.getItem('user_id'),
            variants: this.userVariant,
            interaction: interaction,
            outcome: outcome, // success, partial_success, failure, abandoned
            timestamp: Date.now()
        };

        this.saveExperimentResult(result);
    }

    saveExperimentResult(result) {
        const key = 'experiment_results';
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push(result);
        localStorage.setItem(key, JSON.stringify(existing));
        
        console.log('🔬 Experiment result tracked:', result);
    }

    // Analyze experiment performance
    analyzeResults() {
        const results = JSON.parse(localStorage.getItem('experiment_results') || '[]');
        
        const analysis = {
            teachingStyle: this.analyzeByVariant(results, 'teachingStyle'),
            responseLength: this.analyzeByVariant(results, 'responseLength')
        };

        console.log('📊 Experiment Analysis:', analysis);
        return analysis;
    }

    analyzeByVariant(results, experimentName) {
        const variantResults = {};
        
        results.forEach(result => {
            const variant = result.variants[experimentName];
            if (!variant) return;
            
            if (!variantResults[variant]) {
                variantResults[variant] = { total: 0, success: 0, partial: 0, failure: 0 };
            }
            
            variantResults[variant].total++;
            variantResults[variant][result.outcome.replace('_success', '')]++;
        });

        // Calculate success rates
        Object.keys(variantResults).forEach(variant => {
            const data = variantResults[variant];
            data.successRate = (data.success + data.partial * 0.5) / data.total;
        });

        return variantResults;
    }
}

export { PromptExperiments };
