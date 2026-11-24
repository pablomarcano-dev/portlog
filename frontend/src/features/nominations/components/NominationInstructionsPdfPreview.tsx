import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Worker code ships with this application, never a third-party CDN.
GlobalWorkerOptions.workerSrc = workerUrl;

export default function NominationInstructionsPdfPreview({ document }: { document: Blob }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(false);
  const [rendering, setRendering] = useState(true);
  const [containerRef, rect] = useResizeObserver();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof getDocument> | undefined;
    setPdf(null);
    setPageNumber(1);
    setError(false);
    setRendering(true);
    void document
      .arrayBuffer()
      .then((bytes) => {
        if (!active) return;
        task = getDocument({ data: new Uint8Array(bytes) });
        return task.promise;
      })
      .then((loaded) => {
        if (active && loaded) setPdf(loaded);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [document]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdf || !canvas || rect.width === 0) return;
    let active = true;
    let renderTask:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']>
      | undefined;
    setRendering(true);
    setError(false);
    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (!active) return;
        const viewport = page.getViewport({ scale: 1 });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const scaled = page.getViewport({
          scale: (Math.min(rect.width, 1100) / viewport.width) * pixelRatio,
        });
        canvas.width = Math.ceil(scaled.width);
        canvas.height = Math.ceil(scaled.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable');
        renderTask = page.render({ canvas, canvasContext: context, viewport: scaled });
        return renderTask.promise;
      })
      .then(() => {
        if (active) setRendering(false);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, rect.width]);

  return (
    <Stack gap="sm">
      {pdf && (
        <Group justify="space-between" wrap="nowrap">
          <Button
            size="xs"
            variant="default"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((value) => value - 1)}
          >
            Previous page
          </Button>
          <Text size="sm" aria-live="polite">
            Page {pageNumber} of {pdf.numPages}
          </Text>
          <Button
            size="xs"
            variant="default"
            disabled={pageNumber >= pdf.numPages}
            onClick={() => setPageNumber((value) => value + 1)}
          >
            Next page
          </Button>
        </Group>
      )}
      {error && (
        <Alert color="red">
          This PDF could not be displayed. Close the preview and download the Word document.
        </Alert>
      )}
      {!error && rendering && (
        <Center>
          <Loader size="sm" aria-label="Rendering document page" />
        </Center>
      )}
      <div ref={containerRef} style={{ width: '100%', minHeight: 160, overflow: 'auto' }}>
        <canvas
          ref={canvasRef}
          aria-label={`Instruction document page ${pageNumber}`}
          role="img"
          style={{
            display: error || rendering ? 'none' : 'block',
            width: '100%',
            maxWidth: 1100,
            height: 'auto',
            marginInline: 'auto',
          }}
        />
      </div>
    </Stack>
  );
}
