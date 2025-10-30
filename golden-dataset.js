// Golden Dataset Creation for Prompt Optimization
// Collect and curate high-quality interaction examples

class GoldenDataset {
    constructor() {
        this.examples = [];
        this.categories = {
            'concept_explanation': [],
            'step_by_step_guidance': [],
            'error_correction': [],
            'encouraging_stuck_student': [],
            'visual_analysis': [],
            'algorithm_walkthrough': []
        };
    }

    // Add a golden example with metadata
    addGoldenExample(example) {
        const goldenExample = {
            id: this.generateId(),
            timestamp: Date.now(),
            category: example.category,
            studentContext: {
                query: example.studentQuery,
                drawingPresent: example.hasDrawing,
                previousAttempts: example.attemptNumber || 1,
                strugglingIndicators: example.strugglingIndicators || [],
                skillLevel: example.skillLevel || 'unknown'
            },
            aiResponse: example.aiResponse,
            outcome: {
                studentSatisfaction: example.satisfaction, // 1-5 scale
                followUpSuccess: example.followUpSuccess, // boolean
                learningEvidence: example.learningEvidence, // what student did after
                timeToNextSuccess: example.timeToNextSuccess // minutes
            },
            promptUsed: example.promptUsed,
            metrics: {
                responseLength: example.aiResponse.length,
                questionCount: this.countQuestions(example.aiResponse),
                exampleCount: this.countExamples(example.aiResponse),
                encouragementLevel: this.analyzeEncouragement(example.aiResponse)
            },
            tags: example.tags || []
        };

        this.examples.push(goldenExample);
        this.categories[example.category].push(goldenExample);
        
        console.log('🏆 Golden example added:', goldenExample.id);
        return goldenExample.id;
    }

    generateId() {
        // Use cryptographically strong randomness when available
        const getSecureRandomHex = (bytes = 8) => {
            if (globalThis.crypto && globalThis.crypto.getRandomValues) {
                const arr = new Uint8Array(bytes);
                globalThis.crypto.getRandomValues(arr);
                return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
            }
            // Fallback without Math.random to satisfy security rule; ensure low collision risk
            const now = Date.now().toString(16);
            let counterNum = this._idCounter || 0;
            counterNum += 1;
            this._idCounter = counterNum;
            const counter = counterNum.toString(16);
            return (now + counter).slice(-bytes * 2).padStart(bytes * 2, '0');
        };

        return 'golden_' + Date.now().toString(36) + getSecureRandomHex(8);
    }

    countQuestions(text) {
        return (text.match(/\?/g) || []).length;
    }

    countExamples(text) {
        const exampleIndicators = ['for example', 'e.g.', 'such as', 'like when', 'imagine'];
        return exampleIndicators.reduce((count, indicator) => {
            return count + (text.toLowerCase().split(indicator).length - 1);
        }, 0);
    }

    analyzeEncouragement(text) {
        const encouragementWords = [
            'great', 'good', 'excellent', 'well done', 'nice work', 'keep going',
            'you can do', 'almost there', 'good thinking', 'right idea'
        ];
        
        const matches = encouragementWords.filter(word => 
            text.toLowerCase().includes(word)
        );
        
        return matches.length;
    }

    // Get examples for prompt engineering
    getExamplesForPrompt(category, count = 3) {
        const categoryExamples = this.categories[category] || [];
        
        // Sort by outcome quality (satisfaction * follow-up success)
        const sortedExamples = categoryExamples
            .filter(ex => ex.outcome.studentSatisfaction >= 4)
            .sort((a, b) => {
                const scoreA = a.outcome.studentSatisfaction * (a.outcome.followUpSuccess ? 2 : 1);
                const scoreB = b.outcome.studentSatisfaction * (b.outcome.followUpSuccess ? 2 : 1);
                return scoreB - scoreA;
            });

        return sortedExamples.slice(0, count).map(ex => ({
            studentQuery: ex.studentContext.query,
            goldenResponse: ex.aiResponse,
            context: ex.studentContext,
            whyItWorked: this.analyzeWhyItWorked(ex)
        }));
    }

    analyzeWhyItWorked(example) {
        const analysis = [];
        
        if (example.metrics.questionCount > 0) {
            analysis.push('Used guiding questions effectively');
        }
        
        if (example.metrics.exampleCount > 0) {
            analysis.push('Provided concrete examples');
        }
        
        if (example.metrics.encouragementLevel > 0) {
            analysis.push('Included encouraging language');
        }
        
        if (example.outcome.followUpSuccess) {
            analysis.push('Led to successful follow-up engagement');
        }

        let lengthCategory;
        if (example.metrics.responseLength < 100) {
            lengthCategory = 'concise';
        } else if (example.metrics.responseLength < 200) {
            lengthCategory = 'moderate';
        } else {
            lengthCategory = 'detailed';
        }
        analysis.push(`Optimal response length (${lengthCategory})`);
        
        return analysis;
    }

    // Generate prompt templates from golden examples
    generatePromptTemplate(category) {
        const examples = this.getExamplesForPrompt(category, 5);
        if (examples.length === 0) return null;

        const commonPatterns = this.extractCommonPatterns(examples);
        
        const template = {
            category: category,
            description: `Optimized prompt for ${category} based on ${examples.length} golden examples`,
            structure: commonPatterns.structure,
            keyPhrases: commonPatterns.keyPhrases,
            dosList: commonPatterns.dosList,
            dontsList: commonPatterns.dontsList,
            examples: examples.slice(0, 2), // Include top 2 examples
            promptTemplate: this.buildPromptTemplate(commonPatterns, category)
        };

        console.log(`📝 Generated prompt template for ${category}:`, template);
        return template;
    }

    extractCommonPatterns(examples) {
        const patterns = {
            structure: [],
            keyPhrases: [],
            dosList: [],
            dontsList: []
        };

        // Analyze response structures
        examples.forEach(ex => {
            const response = ex.goldenResponse;
            
            // Common opening patterns
            if (response.toLowerCase().startsWith('let me help')) {
                patterns.keyPhrases.push('Supportive opening');
            }
            
            // Question patterns
            if (ex.whyItWorked.includes('Used guiding questions effectively')) {
                patterns.dosList.push('Use guiding questions to promote discovery');
            }
            
            // Example usage
            if (ex.whyItWorked.includes('Provided concrete examples')) {
                patterns.dosList.push('Include concrete, relevant examples');
            }
        });

        return patterns;
    }

    buildPromptTemplate(patterns, category) {
        let template = `You are an AI tutor helping students with algorithmic thinking and problem-solving.\n\n`;
        
        template += `CONTEXT: Student is asking for help with ${category}.\n\n`;
        
        template += `GUIDELINES:\n`;
        patterns.dosList.forEach((item, index) => {
            template += `${index + 1}. ${item}\n`;
        });
        
        if (patterns.dontsList.length > 0) {
            template += `\nAVOID:\n`;
            patterns.dontsList.forEach((item) => {
                template += `- ${item}\n`;
            });
        }
        
        template += `\nYour response should be helpful, encouraging, and promote learning through understanding rather than rote memorization.\n`;
        
        return template;
    }

    // Export dataset for external analysis
    exportDataset() {
        return {
            metadata: {
                totalExamples: this.examples.length,
                categories: Object.keys(this.categories).map(cat => ({
                    name: cat,
                    count: this.categories[cat].length
                })),
                exportTimestamp: Date.now()
            },
            examples: this.examples,
            templates: Object.keys(this.categories).map(cat => 
                this.generatePromptTemplate(cat)
            ).filter(Boolean)
        };
    }

    // Import curated examples (for team collaboration)
    importExamples(importData) {
        importData.examples.forEach(example => {
            this.examples.push(example);
            if (!this.categories[example.category]) {
                this.categories[example.category] = [];
            }
            this.categories[example.category].push(example);
        });
        
        console.log(`📥 Imported ${importData.examples.length} golden examples`);
    }
}

export { GoldenDataset };
