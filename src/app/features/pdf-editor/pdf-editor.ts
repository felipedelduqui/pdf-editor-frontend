import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

import 'pdfjs-dist/build/pdf.worker.mjs';

@Component({
  selector: 'app-pdf-editor',
  standalone: true,
  imports: [],
  templateUrl: './pdf-editor.html',
  styleUrl: './pdf-editor.scss',
})
export class PdfEditor {
  @ViewChild('pdfCanvas') pdfCanvas!: ElementRef<HTMLCanvasElement>;

  pdfFile: File | null = null;
  selectedColor: string = '#FF3B30';
  selectedThickness: number = 5;
  currentTool: 'brush' | 'bucket' = 'brush';

  public isDrawing = false;
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
      setTimeout(() => { this.renderPdfPage(); }, 50);
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
        
        const canvas = this.pdfCanvas.nativeElement;
        const context = canvas.getContext('2d');
        
        if (context) {
          this.ctx = context;
          
          const desiredWidth = canvas.parentElement?.clientWidth || 500;
          const viewport = page.getViewport({ scale: 1 });
          const scale = desiredWidth / viewport.width;
          const responsiveViewport = page.getViewport({ scale: scale });
          
          canvas.width = responsiveViewport.width;
          canvas.height = responsiveViewport.height;

          const renderContext = {
            canvas: canvas,
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
      
      // CORREÇÃO: Se a cor selecionada for preta ou muito escura, usamos 'source-over'
      // para agir como uma cobertura real. Caso contrário, usamos 'multiply' para o efeito marca-texto.
      if (this.selectedColor === '#000000' || this.selectedColor === '#1A1A1A') {
        this.ctx.globalCompositeOperation = 'source-over';
      } else {
        this.ctx.globalCompositeOperation = 'multiply';
      }
    }

  setTool(tool: 'brush' | 'bucket'): void {
    this.currentTool = tool;
  }

  // Método público acessível pelo HTML
  onCanvasClick(event: MouseEvent): void {
    const rect = this.pdfCanvas.nativeElement.getBoundingClientRect();
    const x = Math.floor(event.clientX - rect.left);
    const y = Math.floor(event.clientY - rect.top);

    if (this.currentTool === 'bucket') {
      this.executeFloodFill(x, y);
    } else {
      this.startDrawing(x, y);
    }
  }

  // Alterado para public para o Angular compilar o encapsulamento do template
  public startDrawing(x: number, y: number): void {
    this.isDrawing = true;
    this.ctx.beginPath();
    this.setupBrushStyles();
    this.ctx.moveTo(x, y);
  }

  draw(event: MouseEvent): void {
    if (!this.isDrawing || this.currentTool !== 'brush') return;
    const rect = this.pdfCanvas.nativeElement.getBoundingClientRect();
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

  private executeFloodFill(startX: number, startY: number): void {
      const canvas = this.pdfCanvas.nativeElement;
      const width = canvas.width;
      const height = canvas.height;
      
      const imgData = this.ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const targetColor = this.hexToRgba(this.selectedColor);
      
      const startPos = (startY * width + startX) * 4;
      let startR = data[startPos];
      let startG = data[startPos + 1];
      let startB = data[startPos + 2];
      let startA = data[startPos + 3];

      // CORREÇÃO SEGURANÇA: Se o clique acontecer em cima de um texto/linha preta (R, G, B baixos),
      // nós impedimos o balde de pintar o texto, forçando o alvo para o branco de fundo.
      const ePixelEscuro = startR < 150 && startG < 150 && startB < 150;
      if (ePixelEscuro) {
        // Alinha o alvo para buscar variações de branco do papel, impedindo a destruição do texto
        startR = 255;
        startG = 255;
        startB = 255;
        startA = 255;
      }

      if (this.matchColor(startR, startG, startB, startA, targetColor.r, targetColor.g, targetColor.b, 255)) {
        return;
      }

      const queue: [number, number][] = [[startX, startY]];
      
      // Força o modo de desenho padrão para a injeção de pixels do balde funcionar isolada
      this.ctx.globalCompositeOperation = 'source-over';

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        let pixelPos = (cy * width + cx) * 4;

        let currentY = cy;
        while (currentY >= 0 && this.matchColor(data[pixelPos], data[pixelPos+1], data[pixelPos+2], data[pixelPos+3], startR, startG, startB, startA)) {
          currentY--;
          pixelPos -= width * 4;
        }
        currentY++;
        pixelPos += width * 4;

        let reachLeft = false;
        let reachRight = false;

        while (currentY < height && this.matchColor(data[pixelPos], data[pixelPos+1], data[pixelPos+2], data[pixelPos+3], startR, startG, startB, startA)) {
          
          data[pixelPos] = targetColor.r;
          data[pixelPos + 1] = targetColor.g;
          data[pixelPos + 2] = targetColor.b;
          data[pixelPos + 3] = 255;

          if (cx > 0) {
            const leftPos = pixelPos - 4;
            if (this.matchColor(data[leftPos], data[leftPos+1], data[leftPos+2], data[leftPos+3], startR, startG, startB, startA)) {
              if (!reachLeft) {
                queue.push([cx - 1, currentY]);
                reachLeft = true;
              }
            } else if (reachLeft) {
              reachLeft = false;
            }
          }

          if (cx < width - 1) {
            const rightPos = pixelPos + 4;
            if (this.matchColor(data[rightPos], data[rightPos+1], data[rightPos+2], data[rightPos+3], startR, startG, startB, startA)) {
              if (!reachRight) {
                queue.push([cx + 1, currentY]);
                reachRight = true;
              }
            } else if (reachRight) {
              reachRight = false;
            }
          }

          currentY++;
          pixelPos += width * 4;
        }
      }

      this.ctx.putImageData(imgData, 0, 0);
      
      // Restaura as configurações do pincel após terminar o Flood Fill
      this.setupBrushStyles();
    }
  private matchColor(r1: number, g1: number, b1: number, a1: number, r2: number, g2: number, b2: number, a2: number): boolean {
    const tolerance = 30;
    return Math.abs(r1 - r2) <= tolerance &&
           Math.abs(g1 - g2) <= tolerance &&
           Math.abs(b1 - b2) <= tolerance &&
           Math.abs(a1 - a2) <= tolerance;
  }

  private hexToRgba(hex: string): { r: number, g: number, b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  changeColor(color: string): void { this.selectedColor = color; }
  changeThickness(event: Event): void { this.selectedThickness = Number((event.target as HTMLInputElement).value); }
  resetEditor(): void { if (this.pdfFile) this.renderPdfPage(); }
  saveDocument(): void { console.log('Exporting document...'); }
}