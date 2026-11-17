import type { ReactNode } from "react";
import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { listNumbers, toCell, toRuns } from "./blockModel";
import type { ExportBlock, TableContentModel, TextRun } from "./blockModel";
import { backgroundColorOf, textColorOf } from "./colors";
import type { MermaidImage } from "./mermaidExport";

export const PDF_FONT = "Pretendard";

const styles = StyleSheet.create({
  page: { paddingVertical: 48, paddingHorizontal: 56, fontFamily: PDF_FONT, fontSize: 10.5, lineHeight: 1.6, color: "#37352f" },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
  block: { marginBottom: 4 },
  children: { paddingLeft: 18 },
  listRow: { flexDirection: "row" },
  marker: { width: 16 },
  listBody: { flex: 1 },
  quote: { borderLeftWidth: 3, borderLeftColor: "#37352f", paddingLeft: 10 },
  callout: { padding: 10, borderRadius: 4 },
  calloutPlain: { borderWidth: 1, borderColor: "#e9e9e7" },
  code: { backgroundColor: "#f7f6f3", padding: 10, borderRadius: 4, fontSize: 9.5 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e9e9e7", marginVertical: 8 },
  checkbox: { width: 9, height: 9, borderWidth: 1, borderColor: "#37352f", marginTop: 4, marginRight: 7 },
  checkboxChecked: { backgroundColor: "#2383e2", borderColor: "#2383e2" },
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#e9e9e7", marginVertical: 4 },
  row: { flexDirection: "row" },
  cell: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#e9e9e7", padding: 5 },
  headerCell: { backgroundColor: "#f7f6f3", fontWeight: 700 },
  image: { maxWidth: "100%", marginVertical: 4 },
  caption: { fontSize: 9, color: "#787774" },
  fileLink: { color: "#787774", textDecoration: "underline" },
  diagram: { alignItems: "center", marginVertical: 4 },
});

// A4(595pt)에서 좌우 여백(56pt씩)을 뺀 본문 폭
const CONTENT_WIDTH = 595 - 56 * 2;

const HEADING_SIZES: Record<number, number> = { 1: 20, 2: 16, 3: 13.5, 4: 12, 5: 11, 6: 10.5 };

// 글자 조각 하나의 모양 (이탤릭 글꼴이 없어 기울임은 생략)
function runStyle(run: TextRun): Style {
  const style: Style = {};
  if (run.bold) style.fontWeight = 700;
  const decorations = [run.underline && "underline", run.strike && "line-through"].filter(Boolean);
  if (decorations.length > 0) style.textDecoration = decorations.join(" ") as Style["textDecoration"];
  const color = textColorOf(run.textColor);
  if (color) style.color = color;
  const background = backgroundColorOf(run.backgroundColor) ?? (run.code ? "#f2f1ee" : undefined);
  if (background) style.backgroundColor = background;
  if (run.code) style.color = "#eb5757";
  return style;
}

// 인라인 내용을 글자 조각들로 그림 (링크는 누를 수 있는 링크로)
function Runs({ content }: { content: ExportBlock["content"] }) {
  const runs = toRuns(Array.isArray(content) ? content : undefined);
  return (
    <>
      {runs.map((run, i) => (run.href
        ? <Link key={i} src={run.href} style={runStyle(run)}>{run.text}</Link>
        : <Text key={i} style={runStyle(run)}>{run.text}</Text>))}
    </>
  );
}

// 블록 자체의 글자색·배경색·정렬
function blockStyle(block: ExportBlock): Style {
  const style: Style = {};
  const color = textColorOf(block.props?.textColor);
  if (color) style.color = color;
  const background = backgroundColorOf(block.props?.backgroundColor);
  if (background) {
    style.backgroundColor = background;
    style.paddingHorizontal = 3;
  }
  const align = block.props?.textAlignment;
  if (align === "center" || align === "right" || align === "justify") style.textAlign = align;
  return style;
}

function TableBlock({ content }: { content: TableContentModel }) {
  const headerRows = content.headerRows ?? 0;
  const headerCols = content.headerCols ?? 0;
  return (
    <View style={styles.table} wrap={false}>
      {content.rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.cells.map((rawCell, c) => {
            const cell = toCell(rawCell);
            const props = cell.props ?? {};
            const isHeader = r < headerRows || c < headerCols;
            const background = backgroundColorOf(props.backgroundColor);
            const color = textColorOf(props.textColor);
            const span = Number(props.colspan) > 1 ? Number(props.colspan) : 1;
            return (
              <View
                key={c}
                style={[styles.cell, { flex: span }, isHeader ? styles.headerCell : {},
                  background ? { backgroundColor: background } : {}]}
              >
                <Text style={[isHeader ? { fontWeight: 700 } : {}, color ? { color } : {}]}>
                  <Runs content={cell.content} />
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// 한 블록과 그 하위 블록을 그림 (number: 번호 목록 번호)
function BlockView({ block, number }: { block: ExportBlock; number?: number }) {
  const props = block.props ?? {};
  const children = block.children && block.children.length > 0
    ? <View style={styles.children}><Blocks blocks={block.children} /></View>
    : null;
  let body: ReactNode;

  switch (block.type) {
    case "heading": {
      const size = HEADING_SIZES[Number(props.level)] ?? HEADING_SIZES[1];
      body = <Text style={[{ fontSize: size, fontWeight: 700, marginTop: 8 }, blockStyle(block)]}><Runs content={block.content} /></Text>;
      break;
    }
    case "bulletListItem":
    case "numberedListItem":
    case "toggleListItem":
      body = (
        <View style={styles.listRow}>
          <Text style={styles.marker}>
            {block.type === "numberedListItem" ? `${number ?? 1}.` : block.type === "toggleListItem" ? "▸" : "•"}
          </Text>
          <Text style={[styles.listBody, blockStyle(block)]}><Runs content={block.content} /></Text>
        </View>
      );
      break;
    case "checkListItem":
      body = (
        <View style={styles.listRow}>
          <View style={[styles.checkbox, props.checked ? styles.checkboxChecked : {}]} />
          <Text style={[styles.listBody, blockStyle(block), props.checked ? { color: "#9b9a97", textDecoration: "line-through" } : {}]}>
            <Runs content={block.content} />
          </Text>
        </View>
      );
      break;
    case "quote":
      body = <Text style={[styles.quote, blockStyle(block)]}><Runs content={block.content} /></Text>;
      break;
    case "callout": {
      // 안의 글(하위 블록)을 들여쓰지 않고 배경색 상자 안에 그림 (한글 글꼴에 이모지가 없어 아이콘은 생략, 노션처럼 기본 배경도 회색)
      const background = backgroundColorOf(props.backgroundColor === "default" ? "gray" : props.backgroundColor);
      return (
        <View style={styles.block}>
          <View style={[styles.callout, background ? { backgroundColor: background } : styles.calloutPlain]}>
            <Blocks blocks={block.children ?? []} />
          </View>
        </View>
      );
    }
    case "codeBlock": {
      const code = <Text style={styles.code}><Runs content={block.content} /></Text>;
      // 내보내기 전에 그려 둔 Mermaid 그림이 있으면 보기 방식대로 코드·그림을 함께 넣음
      const image = props.mermaidImage as MermaidImage | undefined;
      if (!image) {
        body = code;
        break;
      }
      const width = Math.min(image.width * 0.75, CONTENT_WIDTH);
      const diagram = (
        <View wrap={false} style={styles.diagram}>
          <Image src={image.src} style={{ width, height: (width * image.height) / image.width }} />
        </View>
      );
      body = props.mermaidView === "preview" ? diagram : <>{code}{diagram}</>;
      break;
    }
    case "divider":
      body = <View style={styles.divider} />;
      break;
    case "table":
      body = block.content && !Array.isArray(block.content) ? <TableBlock content={block.content} /> : null;
      break;
    case "image":
      body = typeof props.url === "string" && props.url ? (
        <View wrap={false}>
          <Image src={props.url} style={styles.image} />
          {typeof props.caption === "string" && props.caption && <Text style={styles.caption}>{props.caption}</Text>}
        </View>
      ) : null;
      break;
    case "schedule":
      // 일정(WBS) 표는 PDF로 그리지 않고 안내만 남김
      body = <Text style={styles.fileLink}>일정(WBS) 표는 팀 포털에서 확인하세요.</Text>;
      break;
    case "file":
    case "video":
    case "audio":
      // 문서 안에 넣을 수 없는 파일은 이름만 남김 (한글 글꼴에 이모지가 없어 글자로 표시)
      body = <Text style={styles.fileLink}>첨부: {String(props.name || props.url || "파일")}</Text>;
      break;
    default:
      body = <Text style={blockStyle(block)}><Runs content={block.content} /></Text>;
  }

  return (
    <View style={styles.block}>
      {body}
      {children}
    </View>
  );
}

function Blocks({ blocks }: { blocks: ExportBlock[] }) {
  const numbers = listNumbers(blocks);
  return (
    <>
      {blocks.map((block, i) => <BlockView key={block.id ?? i} block={block} number={numbers.get(i)} />)}
    </>
  );
}

// 페이지 제목과 본문 블록을 A4 PDF 문서로
export function PdfDocument({ title, blocks }: { title: string; blocks: ExportBlock[] }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Blocks blocks={blocks} />
      </Page>
    </Document>
  );
}
