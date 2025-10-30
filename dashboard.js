/* global Chart */
// Dashboard JavaScript for Analytics
class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.loadData();
        this.bindEvents();
        this.initializeCharts();
    }

    loadData() {
        // Load all analytics data from localStorage
        this.analyticsData = this.loadFromStorage('prompt_analytics_*');
        this.engagementData = this.loadFromStorage('engagement_analytics');
        this.experimentResults = this.loadFromStorage('experiment_results');
        this.goldenDataset = this.loadFromStorage('golden_dataset');
        this.detailedFeedback = this.loadFromStorage('detailed_feedback');

        console.log('📊 Dashboard loaded data:', {
            analytics: this.analyticsData.length,
            engagement: this.engagementData.length,
            experiments: this.experimentResults.length,
            golden: this.goldenDataset.length
        });
    }

    loadFromStorage(key) {
        if (key.includes('*')) {
            // Load all matching keys
            const results = [];
            for (let i = 0; i < localStorage.length; i++) {
                const storageKey = localStorage.key(i);
                if (storageKey && storageKey.startsWith(key.replace('*', ''))) {
                    try {
                        const data = JSON.parse(localStorage.getItem(storageKey));
                        if (Array.isArray(data)) {
                            results.push(...data);
                        } else {
                            results.push(data);
                        }
                    } catch (e) {
                        console.warn('Failed to parse:', storageKey, e);
                    }
                }
            }
            return results;
        } else {
            try {
                return JSON.parse(localStorage.getItem(key) || '[]');
            } catch (e) {
                console.warn('Failed to load key:', key, e);
                return [];
            }
        }
    }

    bindEvents() {
        document.getElementById('export-analytics')?.addEventListener('click', () => {
            this.exportData('analytics');
        });

        document.getElementById('export-golden')?.addEventListener('click', () => {
            this.exportData('golden');
        });

        document.getElementById('clear-data')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
                this.clearAllData();
            }
        });

        document.getElementById('refresh-data')?.addEventListener('click', () => {
            this.loadData();
            this.updateDashboard();
        });
    }

    initializeCharts() {
        this.createInteractionTypesChart();
        this.createABTestChart();
        this.updateMetrics();
        this.updateTables();
    }

    createInteractionTypesChart() {
        const ctx = document.getElementById('interaction-types-chart');
        if (!ctx) return;

        const typeCounts = {};
        this.analyticsData.forEach(interaction => {
            typeCounts[interaction.type] = (typeCounts[interaction.type] || 0) + 1;
        });

        const labels = Object.keys(typeCounts);
        const data = Object.values(typeCounts);

        this.charts.interactionTypes = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#3B82F6', '#10B981', '#F59E0B',
                        '#EF4444', '#8B5CF6', '#06B6D4'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createABTestChart() {
        const ctx = document.getElementById('ab-test-chart');
        if (!ctx) return;

        // Analyze experiment results
        const experimentAnalysis = this.analyzeExperiments();
        
        if (Object.keys(experimentAnalysis).length === 0) {
            ctx.getContext('2d').fillText('No A/B test data available', 10, 50);
            return;
        }

        const datasets = [];
        const colors = ['#3B82F6', '#10B981', '#F59E0B'];
        let colorIndex = 0;

        Object.entries(experimentAnalysis).forEach(([experiment, variants]) => {
            Object.entries(variants).forEach(([variant, data]) => {
                datasets.push({
                    label: `${experiment}: ${variant}`,
                    data: [data.successRate * 100],
                    backgroundColor: colors[colorIndex % colors.length],
                    borderColor: colors[colorIndex % colors.length],
                    borderWidth: 1
                });
                colorIndex++;
            });
        });

        this.charts.abTest = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Success Rate %'],
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    analyzeExperiments() {
        const analysis = {};
        
        this.experimentResults.forEach(result => {
            Object.entries(result.variants || {}).forEach(([experiment, variant]) => {
                if (!analysis[experiment]) analysis[experiment] = {};
                if (!analysis[experiment][variant]) {
                    analysis[experiment][variant] = { total: 0, success: 0 };
                }
                
                analysis[experiment][variant].total++;
                if (result.outcome === 'success') {
                    analysis[experiment][variant].success++;
                }
            });
        });

        // Calculate success rates
        Object.values(analysis).forEach(variants => {
            Object.values(variants).forEach(data => {
                data.successRate = data.total > 0 ? data.success / data.total : 0;
            });
        });

        return analysis;
    }

    updateMetrics() {
        // Total Interactions
        document.getElementById('total-interactions').textContent = 
            this.analyticsData.length.toLocaleString();

        // Success Rate (based on feedback)
        const feedbackInteractions = this.analyticsData.filter(i => i.feedback);
        const successfulFeedback = feedbackInteractions.filter(i => i.feedback?.wasHelpful);
        const successRate = feedbackInteractions.length > 0 ? 
            (successfulFeedback.length / feedbackInteractions.length * 100).toFixed(1) : 'N/A';
        document.getElementById('success-rate').textContent = 
            successRate === 'N/A' ? successRate : `${successRate}%`;

        // Average Response Time
        const responseTimes = this.analyticsData.filter(i => i.responseTime);
        const avgResponseTime = responseTimes.length > 0 ?
            (responseTimes.reduce((sum, i) => sum + i.responseTime, 0) / responseTimes.length / 1000).toFixed(1) : 'N/A';
        document.getElementById('avg-response-time').textContent = 
            avgResponseTime === 'N/A' ? avgResponseTime : `${avgResponseTime}s`;

        // Golden Examples Count
        document.getElementById('golden-count').textContent = 
            this.goldenDataset.length.toLocaleString();
    }

    updateTables() {
        this.updateRecentInteractions();
        this.updateTopPrompts();
    }

    updateRecentInteractions() {
        const container = document.getElementById('recent-interactions');
        if (!container) return;

        const recentInteractions = this.analyticsData
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10);

        /* eslint-disable sonarjs/no-nested-conditional */
        container.innerHTML = recentInteractions.map(interaction => `
            <div class="border-l-4 border-blue-500 pl-4 py-2">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-medium text-sm">${interaction.type}</span>
                        <p class="text-xs text-gray-600 mt-1">${interaction.aiResponse?.substring(0, 100)}...</p>
                    </div>
                    <div class="text-xs text-gray-500">
                        ${new Date(interaction.timestamp).toLocaleTimeString()}
                    </div>
                </div>
                ${interaction.feedback ? `
                    <div class="mt-2 text-xs ${interaction.feedback.wasHelpful ? 'text-green-600' : 'text-red-600'}">
                        ${interaction.feedback.wasHelpful ? '👍 Helpful' : '👎 Not helpful'}
                    </div>
                ` : ''}
            </div>
        `).join('');
        /* eslint-enable sonarjs/no-nested-conditional */
    }

    updateTopPrompts() {
        const container = document.getElementById('top-prompts');
        if (!container) return;

        // Analyze prompt performance
        const promptPerformance = {};
        
        this.analyticsData.forEach(interaction => {
            if (interaction.feedback && interaction.promptUsed) {
                if (!promptPerformance[interaction.promptUsed]) {
                    promptPerformance[interaction.promptUsed] = {
                        total: 0, helpful: 0, prompt: interaction.promptUsed
                    };
                }
                promptPerformance[interaction.promptUsed].total++;
                if (interaction.feedback.wasHelpful) {
                    promptPerformance[interaction.promptUsed].helpful++;
                }
            }
        });

        const sortedPrompts = Object.values(promptPerformance)
            .map(p => ({
                ...p,
                successRate: p.total > 0 ? p.helpful / p.total : 0
            }))
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 5);

        container.innerHTML = sortedPrompts.length > 0 ? 
            sortedPrompts.map(prompt => `
                <div class="border border-gray-200 rounded p-3">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-sm font-medium">Success Rate: ${(prompt.successRate * 100).toFixed(1)}%</span>
                        <span class="text-xs text-gray-500">${prompt.total} uses</span>
                    </div>
                    <p class="text-xs text-gray-600">${prompt.prompt.substring(0, 150)}...</p>
                </div>
            `).join('') :
            '<p class="text-gray-500 text-sm">No prompt performance data available yet.</p>';
    }

    exportData(type) {
        let data, filename;
        
        if (type === 'analytics') {
            data = {
                analytics: this.analyticsData,
                engagement: this.engagementData,
                experiments: this.experimentResults,
                detailedFeedback: this.detailedFeedback,
                exportedAt: new Date().toISOString()
            };
            filename = `sl8ai-analytics-${new Date().toISOString().split('T')[0]}.json`;
        } else if (type === 'golden') {
            data = {
                goldenDataset: this.goldenDataset,
                exportedAt: new Date().toISOString(),
                totalExamples: this.goldenDataset.length
            };
            filename = `sl8ai-golden-dataset-${new Date().toISOString().split('T')[0]}.json`;
        }

        this.downloadJSON(data, filename);
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearAllData() {
        // Clear all analytics-related localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.startsWith('prompt_analytics_') ||
                key === 'engagement_analytics' ||
                key === 'experiment_results' ||
                key === 'golden_dataset' ||
                key === 'detailed_feedback'
            )) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Reload data and update dashboard
        this.loadData();
        this.updateDashboard();
        
        alert('All analytics data has been cleared.');
    }

    updateDashboard() {
        this.updateMetrics();
        this.updateTables();
        
        // Recreate charts
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};
        this.createInteractionTypesChart();
        this.createABTestChart();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsDashboard = new AnalyticsDashboard();
});
