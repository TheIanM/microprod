/**
 * Usage Analytics & Gamification System
 * Tracks user engagement and unlocks achievements
 */

class UsageAnalytics {
    constructor() {
        this.data = {
            // Session tracking
            sessionsCount: 0,
            totalRuntime: 0, // milliseconds
            currentSessionStart: null,
            currentSessionDuration: 0,
            
            // Timer analytics
            timerSessions: {
                total: 0,
                completed: 0,
                totalMinutes: 0,
                averageMinutes: 0,
                longestSession: 0
            },
            
            // Todo analytics  
            todoMetrics: {
                listsCreated: 0,
                itemsCreated: 0,
                itemsCompleted: 0,
                completionRate: 0
            },
            
            // OssC interaction metrics
            osscMetrics: {
                clicks: 0,
                demoModeToggled: 0,
                interactionTime: 0
            },
            
            // Achievement system
            achievements: {
                firstTimer: false,
                firstTodo: false,
                productive5: false,    // 5 minutes timer
                productive25: false,   // 25 minutes timer
                productive60: false,   // 60+ minutes timer
                taskMaster: false,     // 10 todos completed
                dedication: false,     // 7 days usage streak
                nightOwl: false,       // Usage after 10 PM
                earlyBird: false,      // Usage before 6 AM
                marathoner: false,     // 3+ hour session
                consistent: false,     // 30 days usage
                powerUser: false       // 100+ timer sessions
            },
            
            // Daily statistics
            dailyStats: {},
            lastUsage: null,
            streak: 0
        };
        
        this.sessionInterval = null;
        this.saveInterval = null;
    }

    // Initialize analytics system
    init() {
        try {
            const saved = localStorage.getItem('ucanduit-analytics');
            if (saved) {
                const loadedData = JSON.parse(saved);
                this.data = { ...this.data, ...loadedData };
                this.checkStreak();
            }
        } catch (error) {
            console.warn('Could not load analytics data:', error);
        }
        
        // Start current session tracking
        this.startSession();
        this.setupPeriodicSave();
        
        console.log('Usage Analytics initialized:', this.getSessionSummary());
        
        // Make analytics accessible from console for debugging/viewing
        window.viewAnalytics = () => this.viewAnalytics();
    }

    // Console debugging function
    viewAnalytics() {
        console.log('📊 Usage Analytics Data:');
        console.log('========================');
        console.table(this.getSessionSummary());
        console.log('\n🏆 Achievements:', this.data.achievements);
        console.log('\n📈 Detailed Data:', this.data);
        return this.exportData();
    }
    
    // Start tracking current session
    startSession() {
        this.data.currentSessionStart = Date.now();
        this.data.currentSessionDuration = 0;
        this.data.sessionsCount++;
        
        // Start session runtime counter
        this.sessionInterval = setInterval(() => {
            this.data.currentSessionDuration = Date.now() - this.data.currentSessionStart;
            this.data.totalRuntime += 1000; // Add 1 second
            this.updateDailyStats();
        }, 1000);
    }
    
    // Update daily statistics
    updateDailyStats() {
        const today = new Date().toDateString();
        if (!this.data.dailyStats[today]) {
            this.data.dailyStats[today] = {
                runtime: 0,
                timers: 0,
                todosCreated: 0,
                todosCompleted: 0
            };
        }
        this.data.dailyStats[today].runtime = this.data.currentSessionDuration;
    }
    
    // Timer event tracking
    trackTimerStart(durationMinutes) {
        this.data.timerSessions.total++;
        const today = new Date().toDateString();
        this.updateDailyStats();
        this.data.dailyStats[today].timers++;
        
        // Check achievements
        this.checkAchievement('firstTimer');
        if (this.data.timerSessions.total >= 100) {
            this.checkAchievement('powerUser');
        }
        
        this.save();
    }
    
    trackTimerComplete(actualMinutes) {
        this.data.timerSessions.completed++;
        this.data.timerSessions.totalMinutes += actualMinutes;
        this.data.timerSessions.averageMinutes = 
            this.data.timerSessions.totalMinutes / this.data.timerSessions.completed;
        
        if (actualMinutes > this.data.timerSessions.longestSession) {
            this.data.timerSessions.longestSession = actualMinutes;
        }
        
        // Check time-based achievements
        if (actualMinutes >= 5) this.checkAchievement('productive5');
        if (actualMinutes >= 25) this.checkAchievement('productive25');
        if (actualMinutes >= 60) this.checkAchievement('productive60');
        if (actualMinutes >= 180) this.checkAchievement('marathoner');
        
        this.save();
    }
    
    // Todo event tracking
    trackTodoCreated(isItem) {
        if (isItem) {
            this.data.todoMetrics.itemsCreated++;
        } else {
            this.data.todoMetrics.listsCreated++;
        }
        
        const today = new Date().toDateString();
        this.updateDailyStats();
        this.data.dailyStats[today].todosCreated++;
        
        this.checkAchievement('firstTodo');
        this.save();
    }
    
    trackTodoCompleted() {
        this.data.todoMetrics.itemsCompleted++;
        this.data.todoMetrics.completionRate = 
            (this.data.todoMetrics.itemsCompleted / this.data.todoMetrics.itemsCreated) * 100;
        
        const today = new Date().toDateString();
        this.updateDailyStats();
        this.data.dailyStats[today].todosCompleted++;
        
        if (this.data.todoMetrics.itemsCompleted >= 10) {
            this.checkAchievement('taskMaster');
        }
        
        this.save();
    }
    
    // OssC interaction tracking
    trackOsscInteraction() {
        this.data.osscMetrics.clicks++;
        this.save();
    }
    
    // Achievement checking
    checkAchievement(achievementKey) {
        if (!this.data.achievements[achievementKey]) {
            this.data.achievements[achievementKey] = true;
            this.showAchievementNotification(achievementKey);
        }
    }
    
    showAchievementNotification(achievementKey) {
        const messages = {
            firstTimer: '🎯 First Timer! You started your first focus session!',
            firstTodo: '📝 Task Starter! You created your first todo!',
            productive5: '⏰ Quick Focus! Completed a 5+ minute session!',
            productive25: '🍅 Pomodoro Pro! Completed a 25+ minute session!',
            productive60: '🔥 Deep Work! Completed a 60+ minute session!',
            taskMaster: '✅ Task Master! Completed 10 todos!',
            dedication: '📅 Week Warrior! 7-day usage streak!',
            nightOwl: '🦉 Night Owl! Late night productivity!',
            earlyBird: '🐦 Early Bird! Early morning focus!',
            marathoner: '🏃 Marathoner! 3+ hour session!',
            consistent: '💪 Consistency Champion! 30 days of usage!',
            powerUser: '⚡ Power User! 100+ timer sessions!'
        };
        
        console.log(`🏆 ACHIEVEMENT UNLOCKED: ${messages[achievementKey]}`);
        
        // Show visual notification if possible
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🏆 Achievement Unlocked!', {
                body: messages[achievementKey],
                icon: '/icon.png'
            });
        }
    }
    
    // Check usage streak
    checkStreak() {
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
        
        if (this.data.lastUsage === yesterday) {
            this.data.streak++;
        } else if (this.data.lastUsage !== today) {
            this.data.streak = 1;
        }
        
        this.data.lastUsage = today;
        
        // Check streak achievements
        if (this.data.streak >= 7) this.checkAchievement('dedication');
        if (this.data.streak >= 30) this.checkAchievement('consistent');
        
        // Check time-based achievements
        const hour = new Date().getHours();
        if (hour >= 22 || hour <= 2) this.checkAchievement('nightOwl');
        if (hour >= 5 && hour <= 6) this.checkAchievement('earlyBird');
    }
    
    // Get session summary for display
    getSessionSummary() {
        const currentSession = Math.floor(this.data.currentSessionDuration / 1000 / 60);
        const totalHours = Math.floor(this.data.totalRuntime / 1000 / 60 / 60);
        const totalMinutes = Math.floor((this.data.totalRuntime / 1000 / 60) % 60);
        
        return {
            'Current Session': `${currentSession} minutes`,
            'Total Sessions': this.data.sessionsCount,
            'Total Runtime': `${totalHours}h ${totalMinutes}m`,
            'Timer Sessions': `${this.data.timerSessions.completed}/${this.data.timerSessions.total}`,
            'Todos Completed': this.data.todoMetrics.itemsCompleted,
            'Current Streak': `${this.data.streak} days`,
            'Achievements': Object.values(this.data.achievements).filter(Boolean).length
        };
    }
    
    // Export data for backup/analysis
    exportData() {
        return {
            summary: this.getSessionSummary(),
            fullData: JSON.parse(JSON.stringify(this.data)),
            exportTime: new Date().toISOString()
        };
    }
    
    // Setup periodic saving
    setupPeriodicSave() {
        this.saveInterval = setInterval(() => {
            this.save();
        }, 30000); // Save every 30 seconds
    }
    
    // Save data to localStorage
    save() {
        try {
            localStorage.setItem('ucanduit-analytics', JSON.stringify(this.data));
        } catch (error) {
            console.warn('Could not save analytics data:', error);
        }
    }
    
    // Clean shutdown
    shutdown() {
        if (this.sessionInterval) {
            clearInterval(this.sessionInterval);
        }
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        this.save();
        console.log('Analytics shutdown complete');
    }
}

// Export for use in other modules
window.UsageAnalytics = UsageAnalytics;