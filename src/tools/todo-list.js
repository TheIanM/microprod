/**
 * Todo List Tool - ES6 Module
 * Supports multiple lists with add/complete functionality and persistent storage
 * Updated: Uses new ToolBase architecture and shared styling
 */

import { ToolBase } from './tool-base.js';

export class TodoListTool extends ToolBase {
    constructor(container) {
        super(container);
        this.lists = {};
        this.activeListId = null;
        this.currentView = 'priority-cycling'; // New priority cycling view
        this.currentPriorityIndex = 0; // Track which priority level we're showing
        this.priorityLevels = ['high', 'medium', 'low'];
        this.addingType = null; // Track what we're adding: 'list' or 'task'
    }
    
    async render() {
        await this.loadTodos();
        this.renderContent();
    }
    
    renderContent() {
        this.container.innerHTML = `
            <div class="tool-container">
                <div class="tool-header">
                    <div class="todo-breadcrumb tool-title"></div>
                    <div class="tool-header-actions">
                        <button class="tool-btn kanban-button" title="Open Kanban Board">
                            <i class="iconoir-kanban-board"></i>
                        </button>
                        <button class="tool-btn add-list-button" style="display: none;" title="Add List">+ Add List</button>
                        <button class="tool-btn add-task-button" style="display: none;" title="Add Task">+ Add Task</button>
                        <button class="tool-btn add-button">+ Add</button>
                    </div>
                </div>
                
                <div class="tool-content">
                    <div class="todo-content" style="max-height: 400px; overflow-y: auto;">
                        <!-- Dynamic content will be rendered here -->
                    </div>
                    
                    <!-- Add item input (hidden by default) -->
                    <div class="add-item-input" style="display: none;">
                        <input type="text" class="tool-input new-item-text" placeholder="What needs to be done?">
                        <div class="tool-row" style="margin-top: 8px; justify-content: flex-end; gap: 8px;">
                            <button class="tool-btn cancel-add">Cancel</button>
                            <button class="tool-btn primary confirm-add">Add</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                /* Priority Badge Styles */
                .priority-badge {
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    margin-right: 8px;
                }
                
                .priority-badge.high {
                    background: var(--danger);
                    color: white;
                }
                
                .priority-badge.medium {
                    background: var(--warning);
                    color: white;
                }
                
                .priority-badge.low {
                    background: var(--success);
                    color: white;
                }
                
                /* Priority List Card Styles */
                .priority-list-card {
                    background: rgba(255,255,255,0.05);
                    border: 2px solid var(--border-color);
                    border-radius: 8px;
                    margin-bottom: 12px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .priority-list-card:hover {
                    border-color: var(--text-primary);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                
                .priority-list-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .priority-list-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--text-primary);
                }
                
                .priority-list-progress {
                    font-size: 12px;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                }
                
                .priority-list-items {
                    margin-top: 8px;
                }
                
                .compact-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 0;
                    font-size: 13px;
                    color: var(--text-primary);
                    cursor: pointer;
                }
                
                .compact-item input[type="checkbox"] {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }
                
                .compact-item span {
                    flex: 1;
                    text-overflow: ellipsis;
                    overflow: hidden;
                    white-space: nowrap;
                }
                
                .empty-items {
                    text-align: center;
                    color: var(--success);
                    font-size: 13px;
                    font-style: italic;
                    padding: 8px;
                }
                
                .more-items {
                    font-size: 12px;
                    color: var(--text-secondary);
                    text-align: center;
                    padding: 4px;
                    font-style: italic;
                }
                
                /* Legacy styles for items view */
                .todo-list-item, .todo-item {
                    background: transparent;
                    border: 2px solid var(--text-primary);
                    border-radius: 8px;
                    margin-bottom: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-weight: 600;
                    position: relative;
                    color: var(--text-primary);
                }
                
                .todo-list-item:hover, .todo-item:hover {
                    background: var(--text-primary);
                    color: var(--background);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                }
                
                .todo-item.completed {
                    text-decoration: line-through;
                    opacity: 0.7;
                    padding-left: 30px;
                }
                
                .todo-item.completed::before {
                    content: "✓";
                    position: absolute;
                    left: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--success);
                    font-weight: bold;
                    font-size: 16px;
                }
                
                .todo-list-meta {
                    font-size: 12px;
                    color: var(--text-secondary);
                    font-weight: 500;
                    margin-top: 4px;
                }
                
                .back-button, .priority-cycle-btn {
                    margin-right: 10px;
                }
                
                .tool-header-actions {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                
                .kanban-button {
                    padding: 8px 10px;
                    font-size: 16px;
                }
                
                .tool-btn.small {
                    padding: 4px 6px;
                    font-size: 12px;
                }
            </style>
        `;
        
        this.updateView();
    }
    
    bindEvents() {
        const addButton = this.find('.add-button');
        const addListButton = this.find('.add-list-button');
        const addTaskButton = this.find('.add-task-button');
        const kanbanButton = this.find('.kanban-button');
        const confirmAdd = this.find('.confirm-add');
        const cancelAdd = this.find('.cancel-add');
        const newItemInput = this.find('.new-item-text');
        
        if (addButton) addButton.addEventListener('click', () => this.showAddInput());
        if (addListButton) addListButton.addEventListener('click', () => this.showAddInput('list'));
        if (addTaskButton) addTaskButton.addEventListener('click', () => this.showAddInput('task'));
        if (kanbanButton) kanbanButton.addEventListener('click', () => this.openKanbanWindow());
        if (confirmAdd) confirmAdd.addEventListener('click', async () => await this.handleAdd());
        if (cancelAdd) cancelAdd.addEventListener('click', () => this.hideAddInput());
        
        if (newItemInput) {
            newItemInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') await this.handleAdd();
                if (e.key === 'Escape') this.hideAddInput();
            });
        }
    }
    
    updateView() {
        const content = this.find('.todo-content');
        const breadcrumb = this.find('.todo-breadcrumb');
        const addButton = this.find('.add-button');
        const addListButton = this.find('.add-list-button');
        const addTaskButton = this.find('.add-task-button');
        
        if (this.currentView === 'priority-cycling') {
            // Show current priority level with cycling functionality
            breadcrumb.style.display = 'flex';
            const currentPriority = this.priorityLevels[this.currentPriorityIndex];
            breadcrumb.innerHTML = `
                <button class="tool-btn priority-cycle-btn" title="Cycle Priority">
                    <i class="iconoir-arrow-right"></i>
                </button>
                <span class="priority-badge ${currentPriority}">${currentPriority.toUpperCase()}</span>
                Priority Lists
            `;
            content.innerHTML = this.renderPriorityLists(currentPriority);
            
            // Show Add List button, hide others
            if (addButton) addButton.style.display = 'none';
            if (addListButton) addListButton.style.display = 'inline-block';
            if (addTaskButton) addTaskButton.style.display = 'none';
            
            // Bind cycle button
            const cycleButton = breadcrumb.querySelector('.priority-cycle-btn');
            if (cycleButton) {
                cycleButton.addEventListener('click', () => this.cyclePriority());
            }
            
            this.bindContentEvents();
        } else if (this.currentView === 'items') {
            // Show breadcrumb in items view for navigation
            breadcrumb.style.display = 'flex';
            const activeList = this.lists[this.activeListId];
            breadcrumb.innerHTML = `
                <button class="tool-btn back-button">← Back</button>
                <i class="iconoir-clipboard-check"></i> ${activeList.name}
            `;
            content.innerHTML = this.renderItems();
            
            // Show Add Task button, hide others
            if (addButton) addButton.style.display = 'none';
            if (addListButton) addListButton.style.display = 'none';
            if (addTaskButton) addTaskButton.style.display = 'inline-block';
            
            // Bind back button
            const backButton = breadcrumb.querySelector('.back-button');
            if (backButton) {
                backButton.addEventListener('click', () => this.showPriorityView());
            }
            
            this.bindContentEvents();
        } else {
            // Default view - show generic Add button
            if (addButton) addButton.style.display = 'inline-block';
            if (addListButton) addListButton.style.display = 'none';
            if (addTaskButton) addTaskButton.style.display = 'none';
        }
    }
    
    renderLists() {
        const listIds = Object.keys(this.lists);
        
        if (listIds.length === 0) {
            return `
                <div style="text-align: center; color: #6c757d; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;"><i class="iconoir-task-list"></i></div>
                    <div style="font-weight: 600; margin-bottom: 5px;">No lists yet</div>
                    <div style="font-size: 14px;">Click "+ Add" to create your first todo list</div>
                </div>
            `;
        }
        
        return listIds.map(listId => {
            const list = this.lists[listId];
            const totalItems = list.items.length;
            const completedItems = list.items.filter(item => item.completed).length;
            
            return `
                <div class="todo-list-item" data-list-id="${listId}">
                    <div>${list.name}</div>
                    <div class="todo-list-meta">
                        ${completedItems}/${totalItems} completed
                        ${totalItems === 0 ? '' : `• ${Math.round((completedItems/totalItems) * 100)}%`}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    renderItems() {
        const activeList = this.lists[this.activeListId];
        
        if (!activeList || Object.keys(activeList.items).length === 0) {
            return `
                <div style="text-align: center; color: #6c757d; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;"><i class="iconoir-clipboard-check"></i></div>
                    <div style="font-weight: 600; margin-bottom: 5px;">No items yet</div>
                    <div style="font-size: 14px;">Click "+ Add" to add your first todo item</div>
                </div>
            `;
        }
        
        // Sort items: incomplete first, then completed
        const itemsArray = Object.values(activeList.items);
        const sortedItems = itemsArray.sort((a, b) => {
            if ((a.status === 'done') !== (b.status === 'done')) {
                return a.status === 'done' ? 1 : -1;
            }
            return a.createdAt - b.createdAt;
        });
        
        return sortedItems.map(item => `
            <div class="todo-item ${item.status === 'done' ? 'completed' : ''}" data-item-id="${item.id}">
                ${item.text}
            </div>
        `).join('');
    }
    
    renderPriorityLists(priority) {
        // Get lists of the specified priority
        const priorityLists = Object.keys(this.lists).filter(listId => 
            this.lists[listId].priority === priority
        );
        
        if (priorityLists.length === 0) {
            return `
                <div style="text-align: center; color: #6c757d; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">
                        <i class="iconoir-task-list"></i>
                    </div>
                    <div style="font-weight: 600; margin-bottom: 5px;">No ${priority} priority lists</div>
                    <div style="font-size: 14px;">Create lists with ${priority} priority to see them here</div>
                </div>
            `;
        }
        
        return priorityLists.slice(0, 3).map(listId => {
            const list = this.lists[listId];
            const itemsArray = Object.values(list.items);
            const totalItems = itemsArray.length;
            const completedItems = itemsArray.filter(item => item.status === 'done').length;
            const incompleteItems = itemsArray.filter(item => item.status !== 'done').slice(0, 3);
            
            return `
                <div class="priority-list-card" data-list-id="${listId}">
                    <div class="priority-list-header">
                        <div class="priority-list-title">${list.name}</div>
                        <button class="tool-btn small kanban-open-btn" data-list-id="${listId}" title="Open in Kanban">
                            <i class="iconoir-external-link"></i>
                        </button>
                    </div>
                    <div class="priority-list-progress">
                        ${completedItems}/${totalItems} completed
                        ${totalItems === 0 ? '' : ` • ${Math.round((completedItems/totalItems) * 100)}%`}
                    </div>
                    <div class="priority-list-items">
                        ${incompleteItems.length === 0 ? 
                            '<div class="empty-items">All tasks completed! ✓</div>' :
                            incompleteItems.map(item => `
                                <div class="compact-item" data-item-id="${item.id}" data-list-id="${listId}">
                                    <input type="checkbox" ${item.status === 'done' ? 'checked' : ''}>
                                    <span>${item.text}</span>
                                </div>
                            `).join('')
                        }
                        ${incompleteItems.length === 3 && totalItems > 3 ? 
                            `<div class="more-items">+${totalItems - 3} more items...</div>` : ''
                        }
                    </div>
                </div>
            `;
        }).join('');
    }
    
    cyclePriority() {
        this.currentPriorityIndex = (this.currentPriorityIndex + 1) % this.priorityLevels.length;
        this.updateView();
    }
    
    showPriorityView() {
        this.currentView = 'priority-cycling';
        this.activeListId = null;
        this.updateView();
    }
    
    showAddInput(type = null) {
        const addInput = this.container.querySelector('.add-item-input');
        const textInput = this.container.querySelector('.new-item-text');
        
        // Determine what we're adding based on type parameter or current context
        if (type) {
            this.addingType = type;
        } else if (this.currentView === 'priority-cycling') {
            this.addingType = 'list';
        } else if (this.currentView === 'items') {
            this.addingType = 'task';
        } else {
            this.addingType = 'list'; // Default fallback
        }
        
        addInput.style.display = 'block';
        textInput.focus();
        textInput.value = '';
        
        if (this.addingType === 'list') {
            textInput.placeholder = 'List name (e.g., "Work Tasks", "Shopping")';
        } else {
            textInput.placeholder = 'What needs to be done?';
        }
    }
    
    hideAddInput() {
        const addInput = this.container.querySelector('.add-item-input');
        addInput.style.display = 'none';
        this.addingType = null; // Reset adding type
    }
    
    async handleAdd() {
        const textInput = this.container.querySelector('.new-item-text');
        const text = textInput.value.trim();
        
        if (!text) return;
        
        if (this.addingType === 'list') {
            // Get current priority for new list
            const currentPriority = this.priorityLevels[this.currentPriorityIndex];
            this.createList(text, currentPriority);
        } else if (this.addingType === 'task') {
            this.createItem(text);
        }
        
        this.hideAddInput();
        this.updateView();
        await this.saveTodos();
    }
    
    createList(name, priority = 'medium') {
        const listId = this.generateId();
        this.lists[listId] = {
            id: listId,
            name: name,
            items: {}, // Change to object format like kanban window
            priority: priority,
            dueDate: null,
            position: Object.keys(this.lists).length,
            createdAt: Date.now()
        };
        
        // Track list creation for analytics
        if (window.usageAnalytics) {
            window.usageAnalytics.trackTodoCreated(false); // false = list, not item
        }
    }
    
    createItem(text) {
        if (!this.activeListId || !this.lists[this.activeListId]) return;
        
        const itemId = this.generateId();
        const list = this.lists[this.activeListId];
        
        // Use kanban-compatible object format
        list.items[itemId] = {
            id: itemId,
            text: text,
            status: 'todo', // Use kanban status instead of completed boolean
            dueDate: null,
            position: Object.keys(list.items).length,
            linkedItems: [],
            createdAt: Date.now(),
            completedAt: null
        };
        
        // Track item creation for analytics
        if (window.usageAnalytics) {
            window.usageAnalytics.trackTodoCreated(true); // true = item
        }
    }
    
    showLists() {
        this.currentView = 'lists';
        this.activeListId = null;
        this.updateView();
    }
    
    showItems(listId) {
        this.currentView = 'items';
        this.activeListId = listId;
        this.updateView();
    }
    
    async toggleItem(itemId) {
        if (!this.activeListId || !this.lists[this.activeListId]) return;
        
        const item = this.lists[this.activeListId].items[itemId];
        if (item) {
            const wasCompleted = item.status === 'done';
            item.status = item.status === 'done' ? 'todo' : 'done';
            item.completedAt = item.status === 'done' ? Date.now() : null;
            
            // Track completion for analytics (only when marking as completed)
            if (!wasCompleted && item.status === 'done' && window.usageAnalytics) {
                window.usageAnalytics.trackTodoCompleted();
            }
            
            this.updateView();
            await this.saveTodos();
        }
    }
    
    bindContentEvents() {
        // Bind priority list card clicks (open list in items view)
        const priorityListCards = this.container.querySelectorAll('.priority-list-card');
        priorityListCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on checkbox or kanban button
                if (e.target.closest('.compact-item input') || e.target.closest('.kanban-open-btn')) {
                    return;
                }
                const listId = card.getAttribute('data-list-id');
                this.showItems(listId);
            });
        });
        
        // Bind compact item checkboxes
        const compactItems = this.container.querySelectorAll('.compact-item input');
        compactItems.forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
                e.stopPropagation();
                const itemContainer = e.target.closest('.compact-item');
                const itemId = itemContainer.getAttribute('data-item-id');
                const listId = itemContainer.getAttribute('data-list-id');
                
                // Temporarily set activeListId to update the correct item
                const originalActiveList = this.activeListId;
                this.activeListId = listId;
                await this.toggleItem(itemId);
                this.activeListId = originalActiveList;
                
                // Refresh the current view
                this.updateView();
            });
        });
        
        // Bind kanban open buttons
        const kanbanOpenBtns = this.container.querySelectorAll('.kanban-open-btn');
        kanbanOpenBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.openKanbanWindow();
            });
        });
        
        // Bind old-style list clicks (for items view)
        const listItems = this.container.querySelectorAll('.todo-list-item');
        listItems.forEach(item => {
            item.addEventListener('click', () => {
                const listId = item.getAttribute('data-list-id');
                this.showItems(listId);
            });
        });
        
        // Bind item clicks (for items view)
        const todoItems = this.container.querySelectorAll('.todo-item');
        todoItems.forEach(item => {
            item.addEventListener('click', async () => {
                const itemId = item.getAttribute('data-item-id');
                await this.toggleItem(itemId);
            });
        });
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    async saveTodos() {
        try {
            // Save directly in kanban-compatible format
            if (window.__TAURI__ && window.__TAURI__.core) {
                await window.__TAURI__.core.invoke('write_json_file', {
                    filename: 'ucanduit-todos.json',
                    data: this.lists
                });
                console.log('✅ Todos saved to external file (kanban format)');
                return;
            }
        } catch (error) {
            console.error('❌ Failed to save todos to file, using storage fallback:', error);
        }
        
        // Fallback to ToolBase storage (also in kanban format)
        this.saveToStorage('lists', this.lists);
    }
    
    async loadTodos() {
        try {
            // First try to load from external file using Tauri
            if (window.__TAURI__ && window.__TAURI__.core) {
                const fileData = await window.__TAURI__.core.invoke('read_json_file', {
                    filename: 'ucanduit-todos.json'
                });
                if (fileData) {
                    this.lists = fileData;
                    console.log('✅ Todos loaded from external file');
                    return;
                }
            }
        } catch (error) {
            console.log('📄 No external todos file found or Tauri unavailable, checking storage');
        }
        
        // Fallback to ToolBase storage
        this.lists = this.loadFromStorage('lists', {});
        
        // Try old localStorage key for migration
        if (Object.keys(this.lists).length === 0) {
            try {
                const oldData = localStorage.getItem('ucanduit-todos');
                if (oldData) {
                    this.lists = JSON.parse(oldData);
                    await this.saveTodos(); // Migrate to new storage
                    localStorage.removeItem('ucanduit-todos'); // Clean up old key
                    console.log('🔄 Migrated todos from old storage');
                }
            } catch (error) {
                console.error('❌ Failed to migrate old todos:', error);
            }
        }
        
        // Add priority field to existing lists that don't have it
        this.migratePriorityField();
    }
    
    migratePriorityField() {
        let needsSave = false;
        Object.keys(this.lists).forEach(listId => {
            const list = this.lists[listId];
            
            // Add priority field if missing
            if (!list.priority) {
                list.priority = 'medium'; // Default to medium priority
                needsSave = true;
            }
            
            // Add other kanban fields if missing
            if (!list.dueDate) {
                list.dueDate = null;
                needsSave = true;
            }
            if (list.position === undefined) {
                list.position = 0;
                needsSave = true;
            }
            
            // Convert items from array to object format if needed
            if (Array.isArray(list.items)) {
                const itemsObject = {};
                list.items.forEach((item, index) => {
                    const itemId = item.id || this.generateId();
                    itemsObject[itemId] = {
                        id: itemId,
                        text: item.text,
                        status: item.completed ? 'done' : 'todo', // Convert completed boolean to status
                        dueDate: null,
                        position: index,
                        linkedItems: [],
                        createdAt: item.createdAt || Date.now(),
                        completedAt: item.completedAt || null
                    };
                });
                list.items = itemsObject;
                needsSave = true;
                console.log(`🔄 Converted list "${list.name}" items from array to object format`);
            }
        });
        
        if (needsSave) {
            this.saveTodos();
            console.log('🔄 Migrated data to kanban-compatible format');
        }
    }
    
    // Open dedicated kanban board window
    async openKanbanWindow() {
        try {
            if (!window.__TAURI__) {
                // Browser fallback - open in new tab
                const kanbanUrl = '../src/kanban-window.html';
                const kanbanWindow = window.open(kanbanUrl, 'kanban-board', 
                    'width=1000,height=700,resizable=yes,scrollbars=yes');
                    
                if (kanbanWindow) {
                    kanbanWindow.focus();
                    console.log('✅ Kanban window opened in browser mode');
                    if (window.updateStatus) {
                        window.updateStatus('Opened kanban board (browser mode)', 'primary', 2000);
                    }
                } else {
                    throw new Error('Failed to open kanban window - popup blocked?');
                }
                return;
            }

            // Use the same pattern as working memo/weather windows
            if (window.__TAURI__.webview && window.__TAURI__.webviewWindow) {
                const { webviewWindow } = window.__TAURI__;
                
                const windowLabel = `kanban-board-${Date.now()}`;
                const windowTitle = `Kanban Board - ucanduit`;
                    
                const kanbanWindow = new webviewWindow.WebviewWindow(windowLabel, {
                    url: '../src/kanban-window.html',
                    title: windowTitle,
                    width: 1000,
                    height: 700,
                    alwaysOnTop: false,
                    decorations: true,
                    transparent: false,
                    titleBarStyle: 'overlay'
                });

                // Handle window events
                kanbanWindow.once('tauri://created', () => {
                    console.log('✅ Kanban window created successfully');
                    if (window.updateStatus) {
                        window.updateStatus('Kanban board opened', 'success', 2000);
                    }
                });

                kanbanWindow.once('tauri://error', (error) => {
                    console.error('❌ Kanban window creation error:', error);
                    if (window.updateStatus) {
                        window.updateStatus('Failed to open kanban board', 'danger', 3000);
                    }
                });
                
            } else {
                throw new Error('webviewWindow API not available');
            }
            
        } catch (error) {
            console.error('❌ Failed to open kanban window:', error);
            
            // Show user-friendly error message
            if (window.updateStatus) {
                window.updateStatus('Error opening kanban board', 'danger', 3000);
            }
            
            // Fallback: open in browser tab
            const fallbackUrl = '../src/kanban-window.html';
            window.open(fallbackUrl, '_blank', 'width=1000,height=700');
        }
    }
    
    // Override ToolBase destroy method
    async destroy() {
        await this.saveTodos(); // Save before destroying
        super.destroy(); // Call parent destroy
    }
}