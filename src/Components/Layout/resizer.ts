export class Resizer {
    private isResizing = false;
    private startX = 0;
    private startY = 0;
    private startWidth = 0;
    private startHeight = 0;

    constructor() {
        this.initializeResizers();
    }

    private initializeResizers(): void {
        const resizers = document.querySelectorAll('.resizer');
        
        resizers.forEach(resizer => {
            resizer.addEventListener('mousedown', (e) => {
                this.startResize(e as MouseEvent);
            });
        });
    }

    private startResize(e: MouseEvent): void {
        this.isResizing = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        const target = e.target as HTMLElement;
        const container = target.closest('.pane') as HTMLElement;
        
        if (container) {
            this.startWidth = container.offsetWidth;
            this.startHeight = container.offsetHeight;
        }
        
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        e.preventDefault();
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.isResizing) return;
        
        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;
        
        // Handle resize logic here
        console.log('Resizing:', deltaX, deltaY);
    }

    private handleMouseUp(): void {
        this.isResizing = false;
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    }
}
