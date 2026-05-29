import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

import 'pdfjs-dist/build/pdf.worker.mjs';

@Component({
  selector: 'app-pdf-editor',
  imports: [],
  templateUrl: './pdf-editor.html',
  styleUrl: './pdf-editor.scss',
})
export class PdfEditor {
  @ViewChild('pdfCanvas') pdfCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('paintCanvas') paintCanvas!: ElementRef<HTMLCanvasElement>;

  pdfFile: File | null = null;
  selectedColor: string = '#FF3B30'; // Recomendado testar com cor viva
  selectedThickness: number = 8;

  private isDrawing = false;
  private ctx!: CanvasRenderingContext2D;

  constructor(private cdr: ChangeDetectorRef) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  private processFile(file: File): void {
    if (file.type === 'application/pdf') {
      this.pdfFile = file;
      setTimeout(() => {
        this.renderPdfPage();
      }, 50);
    } else {
      alert('Please upload a valid PDF file.');
    }
  }

  private async renderPdfPage(): Promise<void> {
    try {
      const fileReader = new FileReader();
      fileReader.onload = async () => {
        const typedArray = new Uint8Array(fileReader.result as ArrayBuffer);
        
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = window.URL.createObjectURL(
            new Blob([await (await fetch('/node_modules/pdfjs-dist/build/pdf.worker.mjs')).text()], { type: 'text/javascript' })
          );
        }

        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        const page = await pdf.getPage(1);
        
        const pdfCanvasEl = this.pdfCanvas.nativeElement;
        const paintCanvasEl = this.paintCanvas.nativeElement;
        const pdfCtx = pdfCanvasEl.getContext('2d');
        const paintCtx = paintCanvasEl.getContext('2d');
        
        if (pdfCtx && paintCtx) {
          this.ctx = paintCtx; // O pincel escreve na camada de pintura
          
          const desiredWidth = pdfCanvasEl.parentElement?.clientWidth || 500;
          const viewport = page.getViewport({ scale: 1 });
          const scale = desiredWidth / viewport.width;
          const responsiveViewport = page.getViewport({ scale: scale });
          
          // Sincroniza o tamanho de ambas as camadas baseadas no PDF
          pdfCanvasEl.width = responsiveViewport.width;
          pdfCanvasEl.height = responsiveViewport.height;
          paintCanvasEl.width = responsiveViewport.width;
          paintCanvasEl.height = responsiveViewport.height;

          const renderContext = {
            canvas: pdfCanvasEl,
            viewport: responsiveViewport,
          };
          
          await page.render(renderContext).promise;
          this.setupBrushStyles();
          this.cdr.detectChanges();
        }
      };
      fileReader.readAsArrayBuffer(this.pdfFile!);
    } catch (error) {
      console.error('Failure rendering PDF:', error);
    }
  }

  private setupBrushStyles(): void {
    this.ctx.strokeStyle = this.selectedColor;
    this.ctx.lineWidth = this.selectedThickness;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalCompositeOperation = 'source-over'; // Pintura padrão limpa
  }

  startDrawing(event: MouseEvent): void {
    this.isDrawing = true;
    this.ctx.beginPath();
    const rect = this.paintCanvas.nativeElement.getBoundingClientRect();
    this.ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  }

  draw(event: MouseEvent): void {
    if (!this.isDrawing) return;
    
    const rect = this.paintCanvas.nativeElement.getBoundingClientRect();
    
    // Sincroniza a cor e a espessura selecionadas antes de cada novo segmento de reta
    this.setupBrushStyles();

    this.ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    this.ctx.stroke();
  }

  stopDrawing(): void {
    if (this.isDrawing) {
      this.ctx.closePath();
      this.isDrawing = false;
    }
  }

  changeColor(color: string): void { this.selectedColor = color; }
  changeThickness(event: Event): void { this.selectedThickness = Number((event.target as HTMLInputElement).value); }
  resetEditor(): void { if (this.pdfFile) this.renderPdfPage(); }
  saveDocument(): void { console.log('Exporting document...'); }
}