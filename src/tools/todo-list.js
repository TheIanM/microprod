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
        this.currentView = 'lists'; // 'lists' or 'items'
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
                    <button class="tool-btn add-button">+ Add</button>
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
                
                .todo-list-item:hover .todo-list-meta {
                    color: rgba(255,255,255,0.8);
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
                
                .back-button {
                    margin-right: 10px;
                }
            </style>
        `;
        
        this.updateView();
    }
    
    bindEvents() {
        const addButton = this.find('.add-button');
        const confirmAdd = this.find('.confirm-add');
        const cancelAdd = this.find('.cancel-add');
        const newItemInput = this.find('.new-item-text');
        
        if (addButton) addButton.addEventListener('click', () => this.showAddInput());
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
        
        if (this.currentView === 'lists') {
            // Hide breadcrumb in lists view - title is redundant with collapsible section
            breadcrumb.style.display = 'none';
            content.innerHTML = this.renderLists();
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
            
            // Bind back button
            const backButton = breadcrumb.querySelector('.back-button');
            if (backButton) {
                backButton.addEventListener('click', () => this.showLists());
            }
            
            this.bindContentEvents();
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
        
        if (!activeList || activeList.items.length === 0) {
            return `
                <div style="text-align: center; color: #6c757d; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 10px;"><i class="iconoir-clipboard-check"></i></div>
                    <div style="font-weight: 600; margin-bottom: 5px;">No items yet</div>
                    <div style="font-size: 14px;">Click "+ Add" to add your first todo item</div>
                </div>
            `;
        }
        
        // Sort items: incomplete first, then completed
        const sortedItems = [...activeList.items].sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            return a.createdAt - b.createdAt;
        });
        
        return sortedItems.map(item => `
            <div class="todo-item ${item.completed ? 'completed' : ''}" data-item-id="${item.id}">
                ${item.text}
            </div>
        `).join('');
    }
    
    showAddInput() {
        const addInput = this.container.querySelector('.add-item-input');
        const textInput = this.container.querySelector('.new-item-text');
        
        addInput.style.display = 'block';
        textInput.focus();
        textInput.value = '';
        
        if (this.currentView === 'lists') {
            textInput.placeholder = 'List name (e.g., "Work Tasks", "Shopping")';
        } else {
            textInput.placeholder = 'What needs to be done?';
        }
    }
    
    hideAddInput() {
        const addInput = this.container.querySelector('.add-item-input');
        addInput.style.display = 'none';
    }
    
    async handleAdd() {
        const textInput = this.container.querySelector('.new-item-text');
        const text = textInput.value.trim();
        
        if (!text) return;
        
        if (this.currentView === 'lists') {
            this.createList(text);
        } else {
            this.createItem(text);
        }
        
        this.hideAddInput();
        this.updateView();
        await this.saveTodos();
    }
    
    createList(name) {
        const listId = this.generateId();
        this.lists[listId] = {
            id: listId,
            name: name,
            items: [],
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
        this.lists[this.activeListId].items.push({
            id: itemId,
            text: text,
            completed: false,
            createdAt: Date.now(),
            completedAt: null
        });
        
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
        
        const item = this.lists[this.activeListId].items.find(i => i.id === itemId);
        if (item) {
            const wasCompleted = item.completed;
            item.completed = !item.completed;
            item.completedAt = item.completed ? Date.now() : null;
            
            // Track completion for analytics (only when marking as completed)
            if (!wasCompleted && item.completed && window.usageAnalytics) {
                window.usageAnalytics.trackTodoCompleted();
            }
            
            this.updateView();
            await this.saveTodos();
        }
    }
    
    bindContentEvents() {
        // Bind list clicks
        const listItems = this.container.querySelectorAll('.todo-list-item');
        listItems.forEach(item => {
            item.addEventListener('click', () => {
                const listId = item.getAttribute('data-list-id');
                this.showItems(listId);
            });
        });
        
        // Bind item clicks
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
            // First try to save to external file using Tauri
            if (window.__TAURI__ && window.__TAURI__.core) {
                await window.__TAURI__.core.invoke('write_json_file', {
                    filename: 'ucanduit-todos.json',
                    data: this.lists
                });
                console.log('✅ Todos saved to external file');
                return;
            }
        } catch (error) {
            console.error('❌ Failed to save todos to file, using storage fallback:', error);
        }
        
        // Fallback to ToolBase storage
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
    }
    
    // Override ToolBase destroy method
    async destroy() {
        await this.saveTodos(); // Save before destroying
        super.destroy(); // Call parent destroy
    }
}