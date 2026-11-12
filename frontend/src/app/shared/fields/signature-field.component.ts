import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { FieldDefinition } from '../../core/models/form.models';
import { getFieldAccent } from '../../core/registry/field-registry';
import { FieldShellComponent } from './field-shell.component';

@Component({
  selector: 'app-signature-field',
  standalone: true,
  imports: [FieldShellComponent],
  template: `
    <app-field-shell
      [field]="field"
      [inputId]="inputId"
      [accentColor]="accent"
      [control]="control"
      [serverError]="serverError">
      <div class="sig-wrap" [class.invalid]="isInvalid">
        <canvas
          #pad
          class="sig-canvas"
          [id]="inputId"
          width="560"
          height="144"
          aria-label="Signature canvas"
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp($event)"
          (pointercancel)="onPointerUp($event)">
        </canvas>
        <div class="sig-bar">
          <span class="sig-status">
            @if (hasInk) {
              Signature captured (PNG)
            } @else {
              Sign above using mouse, trackpad, or touch
            }
          </span>
          <button
            type="button"
            class="ff-btn ff-btn-ghost sig-clear"
            [disabled]="!hasInk || control.disabled"
            (click)="clearSignature()">
            Clear ink
          </button>
        </div>
      </div>
    </app-field-shell>
  `,
  styles: [`
    .sig-wrap {
      border: 1px dashed var(--ff-border-strong);
      border-radius: var(--ff-radius-sm);
      background: var(--ff-bg-subtle);
      overflow: hidden;
      transition: border-color 150ms ease-out;
    }
    .sig-wrap.invalid {
      border-color: var(--ff-danger);
      background: #fffafa;
    }
    .sig-canvas {
      display: block;
      width: 100%;
      height: 132px;
      touch-action: none;
      cursor: crosshair;
      background: #ffffff;
    }
    .sig-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      padding: 6px 10px;
      border-top: 1px solid var(--ff-border);
      background: var(--ff-bg-rail);
    }
    .sig-status {
      font-size: 12px;
      color: var(--ff-ink-secondary);
    }
    .sig-clear {
      height: 28px;
      padding: 0 10px;
      font-size: 12px;
      white-space: nowrap;
      flex-shrink: 0;
    }
  `]
})
export class SignatureFieldComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) field!: FieldDefinition;
  @Input({ required: true }) control!: FormControl;
  @Input() serverError?: string | null;

  @ViewChild('pad', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly accent = getFieldAccent('signature');
  hasInk = false;
  private drawing = false;
  private ctx: CanvasRenderingContext2D | null = null;
  private lastX = 0;
  private lastY = 0;

  get inputId(): string {
    return `ff-${this.field.id}`;
  }

  get isInvalid(): boolean {
    return Boolean(this.serverError) || (this.control.invalid && (this.control.dirty || this.control.touched));
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineWidth = 2.4;
      this.ctx.strokeStyle = '#0f172a';
    }
    this.syncFromControl();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['control'] && this.ctx) {
      this.syncFromControl();
    }
  }

  onPointerDown(ev: PointerEvent): void {
    if (this.control.disabled || !this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    canvas.setPointerCapture(ev.pointerId);
    const { x, y } = this.coords(ev);
    this.drawing = true;
    this.lastX = x;
    this.lastY = y;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();
  }

  onPointerMove(ev: PointerEvent): void {
    if (!this.drawing || !this.ctx) return;
    const { x, y } = this.coords(ev);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x;
    this.lastY = y;
    this.hasInk = true;
  }

  onPointerUp(ev: PointerEvent): void {
    if (!this.drawing) return;
    this.drawing = false;
    try {
      this.canvasRef.nativeElement.releasePointerCapture(ev.pointerId);
    } catch {
      // Ignore if pointer already released
    }
    this.hasInk = true;
    const dataUri = this.canvasRef.nativeElement.toDataURL('image/png');
    this.control.setValue(dataUri);
    this.control.markAsDirty();
    this.control.markAsTouched();
  }

  clearSignature(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx?.clearRect(0, 0, canvas.width, canvas.height);
    this.hasInk = false;
    this.control.setValue('');
    this.control.markAsDirty();
    this.control.markAsTouched();
  }

  private coords(ev: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * canvas.width,
      y: ((ev.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  private syncFromControl(): void {
    const val = this.control?.value;
    if (typeof val === 'string' && val.startsWith('data:image/png;base64,')) {
      const img = new Image();
      img.onload = () => {
        const canvas = this.canvasRef.nativeElement;
        this.ctx?.clearRect(0, 0, canvas.width, canvas.height);
        this.ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.hasInk = true;
      };
      img.src = val;
    } else {
      this.hasInk = false;
    }
  }
}
