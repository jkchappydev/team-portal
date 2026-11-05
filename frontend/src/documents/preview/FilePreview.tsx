import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Loader, ScrollArea, Tabs, Text } from "@mantine/core";
import { decodeText, previewKindOf } from "./previewKind";
import type { SheetGrid } from "./xlsxGrid";
import { MAX_COLUMNS, MAX_ROWS } from "./xlsxGrid";

interface Props {
  url: string;
  fileName: string;
}

// 화면을 떠난 뒤 끝난 비동기 작업의 결과는 버리기 위한 표시
interface Run {
  cancelled: boolean;
}

// 파일 본체를 한 번 받아 형식별 미리보기에 넘김 (미리보기를 못 하는 형식은 받지 않음)
function useFileBuffer(url: string, enabled: boolean) {
  const [state, setState] = useState<{ buffer: ArrayBuffer | null; error: boolean }>({ buffer: null, error: false });
  useEffect(() => {
    if (!enabled) return;
    const run: Run = { cancelled: false };
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.arrayBuffer();
      })
      .then((buffer) => !run.cancelled && setState({ buffer, error: false }))
      .catch(() => !run.cancelled && setState({ buffer: null, error: true }));
    return () => {
      run.cancelled = true;
    };
  }, [url, enabled]);
  return state;
}

// 워드 문서를 문서 모양 그대로 그림 (라이브러리는 이때만 불러옴)
function DocxPreview({ buffer }: { buffer: ArrayBuffer }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const run: Run = { cancelled: false };
    import("docx-preview")
      .then(({ renderAsync }) => {
        if (run.cancelled) return;
        body.innerHTML = "";
        return renderAsync(buffer, body, undefined, { inWrapper: true, ignoreLastRenderedPageBreak: true });
      })
      .catch(() => !run.cancelled && setError(true));
    return () => {
      run.cancelled = true;
    };
  }, [buffer]);
  if (error) return <Alert color="red">워드 문서를 표시하지 못했습니다. 다운로드해서 열어 주세요.</Alert>;
  return <Box ref={bodyRef} className="docx-preview" />;
}

// 엑셀 시트를 탭별 표로 그림 (라이브러리는 이때만 불러옴)
function XlsxPreview({ buffer }: { buffer: ArrayBuffer }) {
  const [sheets, setSheets] = useState<SheetGrid[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const run: Run = { cancelled: false };
    Promise.all([import("exceljs"), import("./xlsxGrid")])
      .then(async ([ExcelJS, { buildSheetGrid }]) => {
        const workbook = new ExcelJS.default.Workbook();
        await workbook.xlsx.load(buffer);
        // 숨긴 시트는 미리보기에서 제외
        const grids = workbook.worksheets.filter((ws) => ws.state === "visible").map(buildSheetGrid);
        if (!run.cancelled) setSheets(grids);
      })
      .catch(() => !run.cancelled && setError(true));
    return () => {
      run.cancelled = true;
    };
  }, [buffer]);
  if (error) return <Alert color="red">엑셀 파일을 표시하지 못했습니다. 다운로드해서 열어 주세요.</Alert>;
  if (!sheets) return <Loader size="sm" />;
  if (sheets.length === 0) return <Text c="dimmed">표시할 시트가 없습니다.</Text>;
  return (
    <Tabs defaultValue="0">
      {sheets.length > 1 && (
        <Tabs.List mb="sm">
          {sheets.map((sheet, i) => <Tabs.Tab key={sheet.name} value={String(i)}>{sheet.name}</Tabs.Tab>)}
        </Tabs.List>
      )}
      {sheets.map((sheet, i) => (
        <Tabs.Panel key={sheet.name} value={String(i)}>
          <SheetTable sheet={sheet} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

function SheetTable({ sheet }: { sheet: SheetGrid }) {
  const truncated = sheet.rows.length >= MAX_ROWS || sheet.columnWidths.length >= MAX_COLUMNS;
  return (
    <>
      <ScrollArea type="auto" offsetScrollbars>
        <table className="xlsx-preview" aria-label={`${sheet.name} 시트`}>
          <colgroup>
            {sheet.columnWidths.map((width, i) => <col key={i} style={{ width }} />)}
          </colgroup>
          <tbody>
            {sheet.rows.map((row) => (
              <tr key={row.key} style={{ height: row.height }}>
                {row.cells.map((cell) => (
                  <td key={cell.key} colSpan={cell.colSpan} rowSpan={cell.rowSpan} style={cell.style}>
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      {truncated && (
        <Text size="xs" c="dimmed" mt={4}>
          미리보기는 앞쪽 {MAX_ROWS}행·{MAX_COLUMNS}열까지만 보여줍니다. 전체는 다운로드해서 확인하세요.
        </Text>
      )}
    </>
  );
}

// PDF·이미지는 받은 내용을 브라우저가 직접 보여주도록 임시 주소로 연결
function useObjectUrl(buffer: ArrayBuffer, type: string) {
  const url = useMemo(() => URL.createObjectURL(new Blob([buffer], { type })), [buffer, type]);
  // 화면을 떠나거나 파일이 바뀌면 임시 주소 해제
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return url;
}

function PdfPreview({ buffer, fileName }: { buffer: ArrayBuffer; fileName: string }) {
  const url = useObjectUrl(buffer, "application/pdf");
  return url ? <iframe title={fileName} src={url} style={{ width: "100%", height: "80vh", border: 0 }} /> : null;
}

function ImagePreview({ buffer, fileName }: { buffer: ArrayBuffer; fileName: string }) {
  const url = useObjectUrl(buffer, "image/*");
  return url ? <img src={url} alt={fileName} style={{ maxWidth: "100%" }} /> : null;
}

// 형식별 파일 미리보기 (지원하지 않는 형식은 안내만)
export function FilePreview({ url, fileName }: Props) {
  const kind = previewKindOf(fileName);
  const { buffer, error } = useFileBuffer(url, kind !== "none");

  if (kind === "none") {
    return <Alert color="gray">이 형식은 미리보기를 지원하지 않습니다. 다운로드해서 열어 주세요.</Alert>;
  }
  if (error) return <Alert color="red">파일을 불러오지 못했습니다.</Alert>;
  if (!buffer) return <Loader size="sm" />;
  if (kind === "docx") return <DocxPreview buffer={buffer} />;
  if (kind === "xlsx") return <XlsxPreview buffer={buffer} />;
  if (kind === "pdf") return <PdfPreview buffer={buffer} fileName={fileName} />;
  if (kind === "image") return <ImagePreview buffer={buffer} fileName={fileName} />;
  return (
    <Box component="pre" className="text-preview">
      {decodeText(buffer)}
    </Box>
  );
}
